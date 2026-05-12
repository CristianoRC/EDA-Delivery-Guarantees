import { useSimulatorStore } from '@/stores/simulator'
import { useLogStore } from '@/stores/log'
import { animateMsg, sleep } from './useAnimation'

const POLL_INTERVAL = 1500
const CDC_DELAY = 250
const RELAY_CRASH_RATE = 0.4
const DB_COMMIT_FAIL_RATE = 0.25

let pollTimer = null
let relayBusy = false

export function useOutbox() {
  const store = useSimulatorStore()
  const log = useLogStore()

  async function sendOutboxMessage(amount = 100) {
    store.stats.logicalSent++
    const logicalId = store.nextMsgId()
    const idempotencyKey = `tx-${logicalId}`
    const label = `$${amount} #${logicalId}`

    store.setPhase(`Producer: BEGIN tx for ${idempotencyKey}`)
    store.flash('producer')
    log.push(`📤 Producer: BEGIN tx: credit $${amount} + INSERT INTO outbox (${idempotencyKey})`, 'info')

    const willRollback = store.fails.dbCommit && Math.random() < DB_COMMIT_FAIL_RATE

    await animateMsg('producer', 'outbox', label, '')

    if (willRollback) {
      store.crash('outbox')
      log.push(`❌ DB: COMMIT failed for ${idempotencyKey}, biz + outbox writes rolled back (atomic guarantee)`, 'danger')
      store.stats.lost++
      return
    }

    store.flash('outbox')
    store.stats.expected += amount
    store.outboxRows.push({ id: logicalId, idempotencyKey, amount, label, attempts: 0 })
    store.stats.outboxPending = store.outboxRows.length
    log.push(`✅ DB: COMMIT: biz state + outbox row persisted atomically`, 'ok')

    if (store.outboxMode === 'cdc') {
      scheduleCDC()
    } else {
      schedulePoll()
    }
  }

  function schedulePoll() {
    if (pollTimer || relayBusy) return
    pollTimer = setTimeout(() => {
      pollTimer = null
      runPollCycle()
    }, POLL_INTERVAL)
  }

  async function runPollCycle() {
    if (!store.isOutbox || relayBusy) return
    relayBusy = true
    const batchSize = store.outboxRows.length
    if (batchSize === 0) { relayBusy = false; return }

    store.setPhase(`Polling worker: scanning outbox table`)
    log.push(`🛰️ Poll: SELECT * FROM outbox WHERE published_at IS NULL → ${batchSize} row(s)`, 'info')
    await animateRelayQuery('SELECT pending')

    while (store.isOutbox && store.outboxRows.length > 0) {
      const row = store.outboxRows[0]
      const crashed = await publishRow(row)
      if (crashed) break
    }

    relayBusy = false
    if (store.isOutbox && store.outboxRows.length > 0) schedulePoll()
  }

  function scheduleCDC() {
    if (relayBusy) return
    setTimeout(runCDC, CDC_DELAY)
  }

  async function runCDC() {
    if (!store.isOutbox || relayBusy) return
    relayBusy = true

    await animateRelayQuery('tail tx-log')

    while (store.isOutbox && store.outboxRows.length > 0) {
      const row = store.outboxRows[0]
      store.setPhase(`CDC: streaming change for ${row.idempotencyKey}`)
      log.push(`⚡ CDC: tx-log change captured for ${row.idempotencyKey}`, 'info')
      const crashed = await publishRow(row)
      if (crashed) break
    }

    relayBusy = false
    if (store.isOutbox && store.outboxRows.length > 0) setTimeout(runCDC, CDC_DELAY * 3)
  }

  function removeRow(row) {
    const idx = store.outboxRows.findIndex((r) => r.id === row.id)
    if (idx >= 0) store.outboxRows.splice(idx, 1)
    store.stats.outboxPending = store.outboxRows.length
    store.stats.outboxPublished++
  }

  async function animateRelayQuery(label) {
    if (!store.isOutbox) return
    store.flash('relay')
    await animateMsg('relay', 'outbox', label, 'query')
    store.flash('outbox')
  }

  async function publishRow(row) {
    row.attempts++
    const cls = row.attempts > 1 ? 'dup' : ''
    const halfSpeed = Math.max(300, Math.floor(store.speed / 2))
    const isCDC = store.outboxMode === 'cdc'
    const relayKind = isCDC ? 'CDC' : 'Polling worker'

    store.setPhase(`${relayKind}: reading ${row.idempotencyKey}`)
    store.flash('outbox')
    await animateMsg('outbox', 'relay', row.label, cls, false, halfSpeed)
    store.flash('relay')

    store.setPhase(`${relayKind} → Broker: ${row.idempotencyKey} (attempt ${row.attempts})`)
    store.stats.physicalSent++
    await animateMsg('relay', 'broker', row.label, cls, false, halfSpeed)
    store.flash('broker')
    log.push(`📨 Broker: received ${row.idempotencyKey}${row.attempts > 1 ? ` (republish #${row.attempts})` : ''}, persisting…`, 'dim')
    store.stats.queue++

    // Broker confirms durable receipt back to the relay (publish ACK).
    // Full speed (not halfSpeed) — this is the key handshake that decides whether
    // the relay can safely mark the outbox row, so it should be visible.
    await animateMsg('broker', 'relay', 'CONFIRMED', 'ack')
    store.flash('relay')
    log.push(`✓ Broker → ${relayKind}: publish confirmed (message durable in broker)`, 'dim')

    // Critical crash window: relay has the broker ACK in hand but hasn't marked outbox yet.
    // If it crashes here, the row stays pending → duplicate on re-poll.
    const willCrash = store.fails.relayCrash && Math.random() < RELAY_CRASH_RATE
    if (willCrash) {
      store.crash('relay')
      log.push(`💥 ${relayKind} crashed AFTER broker ACK, BEFORE mark: outbox row stays pending, broker already has the message → duplicate guaranteed on re-poll`, 'danger')
    } else {
      if (isCDC) {
        log.push(`✓ CDC: checkpoint advanced past ${row.idempotencyKey} (tx-log offset committed)`, 'ok')
      } else {
        log.push(`✓ Relay: UPDATE outbox SET published_at = now() WHERE id = ${row.id}`, 'ok')
      }
      removeRow(row)
    }

    // Downstream is decoupled from the relay — broker delivers whatever it received.
    store.stats.queue--
    await animateMsg('broker', 'consumer', row.label, cls)
    store.flash('consumer')
    log.push(`⚙️ Consumer: processing ${row.idempotencyKey}`, 'dim')
    store.stats.processed++

    const isDuplicate = store.processedKeys.has(row.idempotencyKey)
    store.processedKeys.add(row.idempotencyKey)
    store.stats.balance += row.amount
    store.stats.delivered++
    if (isDuplicate) {
      store.stats.duplicated++
      log.push(`⚠️ Consumer: reapplied ${row.idempotencyKey} (no idempotency) → balance $${store.stats.balance}`, 'warn')
    } else {
      log.push(`✅ Consumer: applied ${row.idempotencyKey} → balance $${store.stats.balance}`, 'ok')
    }
    store.flash('db')
    await sleep(150)

    await animateMsg('consumer', 'broker', 'ACK', 'ack')
    log.push(`✔️ Broker: ACK received for ${row.idempotencyKey}`, 'ok')

    return willCrash
  }

  async function sendBatch(count = 5) {
    for (let i = 0; i < count; i++) {
      sendOutboxMessage(100)
      await sleep(Math.max(150, store.speed * 0.25))
    }
  }

  return { sendOutboxMessage, sendBatch }
}
