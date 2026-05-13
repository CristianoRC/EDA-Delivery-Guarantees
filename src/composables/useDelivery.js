import { watch } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
import { useLogStore } from '@/stores/log'
import { animateMsg, sleep } from './useAnimation'
import { useDLQ } from './useDLQ'
import { useOutbox } from './useOutbox'
import { useInbox } from './useInbox'

const MAX_RETRIES = 3

export function useDelivery() {
  const store = useSimulatorStore()
  const log = useLogStore()
  const dlq = useDLQ()
  const outbox = useOutbox()
  const inbox = useInbox()

  let draining = false
  watch(() => store.fails.consumerDown, async (isDown) => {
    if (isDown || draining || store.heldMessages.length === 0) return
    draining = true
    try {
      log.push(`▶️ Consumer recovered, broker draining ${store.heldMessages.length} held message(s)`, 'info')
      while (store.heldMessages.length > 0 && !store.fails.consumerDown) {
        const held = store.heldMessages.shift()
        store.stats.queue--
        log.push(`📨 Broker redelivering held ${held.idempotencyKey}`, 'dim')
        await redeliverFromBroker(held.logicalId, held.idempotencyKey, held.amount, held.label)
        await sleep(150)
      }
    } finally {
      draining = false
    }
  })

  async function sendLogicalMessage(amount = 100) {
    if (store.isDLQ) return dlq.sendDLQMessage()
    if (store.isOutbox) return outbox.sendOutboxMessage(amount)
    if (store.isInbox) return inbox.sendInboxMessage(amount)

    store.stats.logicalSent++
    store.stats.expected += amount
    const logicalId = store.nextMsgId()
    const idempotencyKey = `tx-${logicalId}`
    const label = `$${amount} #${logicalId}`
    log.push(`📤 Producer: new transfer ${idempotencyKey} of $${amount}`, 'info')
    await attemptDelivery(logicalId, idempotencyKey, amount, label, 0)
  }

  async function attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount) {
    const mode = store.mode
    store.setPhase(`Producer publishing ${idempotencyKey}...`)
    store.flash('producer')

    if (store.fails.producer && Math.random() < 0.10) {
      log.push(`❌ Producer ${idempotencyKey}: publish failed`, 'danger')
      if (mode === 'at-most-once') { store.stats.lost++; return }
      if (retryCount < MAX_RETRIES) {
        log.push(`🔁 Producer ${idempotencyKey}: retry #${retryCount + 1}`, 'warn')
        await sleep(300)
        return attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount + 1)
      }
      store.stats.lost++
      return
    }

    store.stats.physicalSent++
    const networkLost = store.fails.network && Math.random() < 0.15
    const cls = retryCount > 0 ? 'retry' : ''

    store.setPhase('In transit: Producer → Broker')
    await animateMsg('producer', 'broker', label, cls, networkLost)

    if (networkLost) {
      log.push(`📡 Network: packet ${idempotencyKey} lost on the way to broker`, 'danger')
      if (mode === 'at-most-once') { store.stats.lost++; return }
      if (retryCount < MAX_RETRIES) {
        log.push(`🔁 Producer ${idempotencyKey}: timeout, retry #${retryCount + 1}`, 'warn')
        await sleep(300)
        return attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount + 1)
      }
      store.stats.lost++
      return
    }

    store.setPhase(`Broker received ${idempotencyKey}`)
    store.flash('broker')
    if (mode === 'exactly-once' && store.brokerSeen.has(idempotencyKey)) {
      log.push(`🛡️ Broker: duplicate detection discarded ${idempotencyKey}`, 'info')
      return
    }
    store.brokerSeen.add(idempotencyKey)
    store.stats.queue++
    log.push(`📨 Broker: enqueued ${idempotencyKey}`, 'dim')
    await sleep(300)

    store.stats.queue--
    store.setPhase('Broker → Consumer')

    if (store.fails.consumerDown) {
      log.push(`💀 Consumer is offline, ${idempotencyKey} cannot be received`, 'danger')
      await animateMsg('broker', 'consumer', label, cls, true)
      if (mode === 'at-most-once') {
        log.push(`🪦 Broker auto-ack on send: ${idempotencyKey} lost (nobody received)`, 'danger')
        store.stats.lost++
        return
      }
      log.push(`⏸️ Broker holding ${idempotencyKey} in queue until consumer recovers`, 'warn')
      store.stats.queue++
      store.heldMessages.push({ logicalId, idempotencyKey, amount, label })
      return
    }

    await animateMsg('broker', 'consumer', label, cls)
    store.flash('consumer')

    if (store.fails.consumerOverload && Math.random() < 0.25) {
      store.crash('consumer')
      log.push(`🚧 Consumer overloaded: dropped ${idempotencyKey} (buffer full / backpressure)`, 'danger')
      if (mode === 'at-most-once') {
        store.stats.lost++
        return
      }
      log.push(`⏰ Broker will redeliver ${idempotencyKey} after backoff`, 'warn')
      await sleep(400)
      return redeliverFromBroker(logicalId, idempotencyKey, amount, label)
    }

    if (mode === 'at-most-once') {
      log.push(`📭 Broker: auto-ack, ${idempotencyKey} removed from queue on delivery`, 'dim')
      if (store.fails.consumer && Math.random() < 0.15) {
        store.crash('consumer')
        log.push(`💥 Consumer crashed before processing ${idempotencyKey} → message lost (broker already discarded)`, 'danger')
        store.stats.lost++
        return
      }
    }

    store.setPhase(`Consumer processing ${idempotencyKey}`)
    log.push(`⚙️ Consumer: processing ${idempotencyKey}`, 'dim')
    store.stats.processed++

    const isDuplicate = store.processedKeys.has(idempotencyKey)
    if (store.idempotency && isDuplicate) {
      log.push(`🛡️ Consumer: ${idempotencyKey} already processed, discarded (idempotency)`, 'ok')
      store.stats.duplicated++
      await sleep(200)
      return sendAck(idempotencyKey, label, mode, logicalId, amount)
    }

    store.processedKeys.add(idempotencyKey)
    store.stats.balance += amount
    store.stats.delivered++
    if (isDuplicate && !store.idempotency) {
      store.stats.duplicated++
      log.push(`⚠️ Consumer: applied ${idempotencyKey} AGAIN (no idempotency) → balance $${store.stats.balance}`, 'warn')
    } else {
      log.push(`✅ Consumer: applied ${idempotencyKey} → balance $${store.stats.balance}`, 'ok')
    }
    store.flash('db')

    if (mode === 'at-most-once') {
      await sleep(200)
      log.push(`✔️ Consumer: ${idempotencyKey} done (no ACK needed in fire-and-forget)`, 'ok')
      return
    }

    if (store.fails.consumer && Math.random() < 0.15) {
      store.crash('consumer')
      log.push(`💥 Consumer crashed after processing ${idempotencyKey} (ACK NOT sent!)`, 'danger')
      store.setPhase('Visibility timeout: broker redelivering...')
      log.push(`⏰ Broker: visibility timeout, redelivering ${idempotencyKey}`, 'warn')
      await sleep(500)
      return redeliverFromBroker(logicalId, idempotencyKey, amount, label)
    }

    await sleep(200)
    return sendAck(idempotencyKey, label, mode, logicalId, amount)
  }

  async function sendAck(idempotencyKey, label, mode, logicalId, amount) {
    const ackLost = store.fails.ack && Math.random() < 0.20
    store.setPhase('Consumer sending ACK...')
    await animateMsg('consumer', 'broker', 'ACK', 'ack', ackLost)
    if (ackLost) {
      log.push(`📡 Network: ACK for ${idempotencyKey} lost!`, 'danger')
      log.push(`⏰ Broker: missing ACK, redelivering ${idempotencyKey}`, 'warn')
      await sleep(400)
      return redeliverFromBroker(logicalId, idempotencyKey, amount, label)
    }
    log.push(`✔️ Broker: ACK received, commit/complete on ${idempotencyKey}`, 'ok')
  }

  async function redeliverFromBroker(logicalId, idempotencyKey, amount, label) {
    store.setPhase('Broker → Consumer (redelivery)')
    await animateMsg('broker', 'consumer', label, 'dup')
    store.flash('consumer')
    store.stats.processed++
    const isDuplicate = store.processedKeys.has(idempotencyKey)
    if (store.idempotency && isDuplicate) {
      log.push(`🛡️ Consumer: redelivery of ${idempotencyKey} discarded (idempotency)`, 'ok')
      store.stats.duplicated++
      await sleep(200)
      return sendAck(idempotencyKey, label, store.mode, logicalId, amount)
    }
    store.processedKeys.add(idempotencyKey)
    store.stats.balance += amount
    store.stats.delivered++
    if (isDuplicate) {
      store.stats.duplicated++
      log.push(`⚠️ Consumer: reapplied ${idempotencyKey} (no idempotency) → balance $${store.stats.balance}`, 'warn')
    } else {
      log.push(`✅ Consumer: applied ${idempotencyKey} → balance $${store.stats.balance}`, 'ok')
    }
    store.flash('db')
    await sleep(200)
    return sendAck(idempotencyKey, label, store.mode, logicalId, amount)
  }

  async function sendBatch(count = 5) {
    if (store.isOutbox) return outbox.sendBatch(count)
    if (store.isInbox) return inbox.sendBatch(count)
    for (let i = 0; i < count; i++) {
      sendLogicalMessage(100)
      await sleep(Math.max(300, store.speed * 0.5))
    }
  }

  async function chaosBurst() {
    store.fails.producer = store.fails.network = store.fails.ack = store.fails.consumer = true
    log.push('🌪️ Chaos burst: 15 messages with ALL failures enabled', 'warn')
    for (let i = 0; i < 15; i++) {
      sendLogicalMessage(100)
      await sleep(Math.max(250, store.speed * 0.4))
    }
  }

  function sendPoisonMessage() {
    if (!store.isDLQ) {
      log.push('⚠️ Poison messages only work in the DLQ scenario', 'warn')
      return
    }
    return dlq.sendPoisonMessage()
  }

  return { sendLogicalMessage, sendBatch, chaosBurst, sendPoisonMessage }
}
