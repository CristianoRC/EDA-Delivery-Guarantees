import { useSimulatorStore } from '@/stores/simulator'
import { useLogStore } from '@/stores/log'
import { animateMsg, sleep } from './useAnimation'

const TX_ABORT_RATE = 0.25
const ACK_LOST_RATE = 0.4
const REDELIVERY_DELAY = 500

export function useInbox() {
  const store = useSimulatorStore()
  const log = useLogStore()

  async function sendInboxMessage(amount = 100) {
    store.stats.logicalSent++
    store.stats.expected += amount
    const logicalId = store.nextMsgId()
    const idempotencyKey = `tx-${logicalId}`
    const label = `$${amount} #${logicalId}`

    store.setPhase(`Producer publishing ${idempotencyKey}`)
    store.flash('producer')
    log.push(`📤 Producer: publish ${idempotencyKey} of $${amount}`, 'info')

    store.stats.physicalSent++
    await animateMsg('producer', 'broker', label, '')
    store.flash('broker')
    store.stats.queue++
    log.push(`📨 Broker: enqueued ${idempotencyKey}`, 'dim')

    await deliverToConsumer({ logicalId, idempotencyKey, amount, label, attempt: 1 })
  }

  async function deliverToConsumer({ logicalId, idempotencyKey, amount, label, attempt }) {
    const cls = attempt > 1 ? 'dup' : ''
    store.setPhase(`Broker → Consumer (attempt ${attempt}) ${idempotencyKey}`)
    await animateMsg('broker', 'consumer', label, cls)
    store.flash('consumer')
    store.stats.queue = Math.max(0, store.stats.queue - 1)

    // Step 1: BEGIN TX + SELECT inbox WHERE message_id = ?
    store.setPhase(`Consumer: BEGIN tx + SELECT inbox for ${idempotencyKey}`)
    log.push(`🔍 Consumer: BEGIN tx → SELECT 1 FROM inbox WHERE message_id = '${idempotencyKey}'`, 'info')
    const alreadySeen = store.inboxKeys.has(idempotencyKey)
    await animateInboxCheck(label, alreadySeen)

    if (alreadySeen) {
      store.stats.inboxDedups++
      store.stats.duplicated++
      log.push(`🛡️ Inbox: ${idempotencyKey} already in inbox table, dedup hit, skipping business write`, 'ok')
      await sleep(200)
      return commitAndAck({ logicalId, idempotencyKey, amount, label, attempt, dedup: true })
    }

    // Step 2: process + atomic write
    store.setPhase(`Consumer: applying ${idempotencyKey} (atomic biz + inbox)`)
    log.push(`⚙️ Consumer: processing ${idempotencyKey}, INSERT INTO inbox + UPDATE balance (same tx)`, 'dim')
    store.stats.processed++
    await sleep(180)

    const willAbort = store.fails.txAbort && Math.random() < TX_ABORT_RATE
    if (willAbort) {
      store.crash('consumer')
      store.stats.txRollbacks++
      log.push(`❌ DB: tx ABORTED for ${idempotencyKey}, inbox row + balance update rolled back atomically (no half-state)`, 'danger')
      await sleep(REDELIVERY_DELAY)
      log.push(`⏰ Broker: no ACK received → redelivering ${idempotencyKey}`, 'warn')
      return deliverToConsumer({ logicalId, idempotencyKey, amount, label, attempt: attempt + 1 })
    }

    store.inboxKeys.add(idempotencyKey)
    store.stats.inboxRows = store.inboxKeys.size
    store.stats.balance += amount
    store.stats.delivered++
    store.flash('inbox')
    log.push(`✅ DB: COMMIT, inbox(${idempotencyKey}) + balance $${store.stats.balance} persisted atomically`, 'ok')
    store.flash('db')
    await sleep(160)

    return commitAndAck({ logicalId, idempotencyKey, amount, label, attempt, dedup: false })
  }

  async function commitAndAck({ logicalId, idempotencyKey, amount, label, attempt, dedup }) {
    const ackLost = store.fails.ackLost && Math.random() < ACK_LOST_RATE
    store.setPhase(`Consumer → Broker: ACK ${idempotencyKey}`)
    await animateMsg('consumer', 'broker', 'ACK', 'ack', ackLost)

    if (ackLost) {
      log.push(`📡 Network: ACK for ${idempotencyKey} lost, broker will redeliver, inbox will catch the duplicate`, 'danger')
      await sleep(REDELIVERY_DELAY)
      log.push(`⏰ Broker: missing ACK → redelivering ${idempotencyKey}`, 'warn')
      return deliverToConsumer({ logicalId, idempotencyKey, amount, label, attempt: attempt + 1 })
    }

    log.push(`✔️ Broker: ACK received for ${idempotencyKey}${dedup ? ' (was a duplicate, inbox absorbed it)' : ''}`, 'ok')
  }

  async function animateInboxCheck(label, isHit) {
    store.flash('consumer')
    await animateMsg('consumer', 'inbox', `lookup ${label}`, 'query')
    store.flash('inbox')
    await animateMsg('inbox', 'consumer', isHit ? 'HIT' : 'miss', isHit ? 'dup' : 'ack')
  }

  async function sendBatch(count = 5) {
    for (let i = 0; i < count; i++) {
      sendInboxMessage(100)
      await sleep(Math.max(180, store.speed * 0.3))
    }
  }

  return { sendInboxMessage, sendBatch }
}
