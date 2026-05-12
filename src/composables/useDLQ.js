import { useSimulatorStore } from '@/stores/simulator'
import { useLogStore } from '@/stores/log'
import { animateMsg, sleep } from './useAnimation'

export function useDLQ() {
  const store = useSimulatorStore()
  const log = useLogStore()

  async function sendDLQMessage({ forcePoison = false } = {}) {
    store.stats.logicalSent++
    const logicalId = store.nextMsgId()
    const id = `msg-${logicalId}`
    const isPoison = forcePoison || Math.random() * 100 < store.poisonRate
    const label = `${isPoison ? '☠️' : '📩'} #${logicalId}`
    const reason = forcePoison ? ' (POISON — invalid payload)' : (isPoison ? ' (POISON)' : '')
    log.push(`📤 Producer: published ${id}${reason}`, 'info')
    await dlqAttempt(id, label, isPoison, 1)
  }

  async function dlqAttempt(id, label, isPoison, deliveryCount) {
    store.setPhase(`Delivery attempt ${deliveryCount} of ${id}`)
    store.flash('producer')
    store.stats.physicalSent++

    if (deliveryCount === 1) {
      await animateMsg('producer', 'broker', label, isPoison ? 'poison' : '')
      store.flash('broker')
      store.stats.queue++
      log.push(`📨 Broker: enqueued ${id}`, 'dim')
      await sleep(200)
      store.stats.queue--
    } else {
      log.push(`⏰ Broker: delivery attempt ${deliveryCount} for ${id}`, 'warn')
    }

    store.setPhase(`Broker → Consumer (attempt ${deliveryCount})`)
    await animateMsg('broker', 'consumer', label, isPoison ? 'poison' : (deliveryCount > 1 ? 'dup' : ''))
    store.flash('consumer')

    const willFail = isPoison || (store.fails.consumer && Math.random() < 0.4)

    if (!willFail) {
      store.stats.delivered++
      log.push(`✅ Consumer: processed ${id} successfully (attempt ${deliveryCount})`, 'ok')
      store.flash('db')
      await sleep(200)
      await animateMsg('consumer', 'broker', 'ACK', 'ack')
      log.push(`✔️ Broker: ACK received for ${id}`, 'ok')
      return
    }

    store.crash('consumer')
    if (isPoison) {
      log.push(`☠️ Consumer: ${id} is POISON — processing failed (attempt ${deliveryCount})`, 'danger')
    } else {
      log.push(`💥 Consumer crashed processing ${id} (attempt ${deliveryCount})`, 'danger')
    }
    if (deliveryCount > 1) store.stats.duplicated++
    await sleep(400)

    if (deliveryCount >= store.maxDeliveryCount) {
      store.setPhase(`Max retries hit — moving ${id} to DLQ`)
      log.push(`🪦 Broker: ${id} exceeded MaxDeliveryCount (${store.maxDeliveryCount}) → DLQ`, 'danger')
      await animateMsg('broker', 'dlq', label, 'dead')
      store.flash('dlq')
      store.stats.deadLettered++
      return
    }

    await sleep(300)
    return dlqAttempt(id, label, isPoison, deliveryCount + 1)
  }

  function sendPoisonMessage() {
    return sendDLQMessage({ forcePoison: true })
  }

  return { sendDLQMessage, sendPoisonMessage }
}
