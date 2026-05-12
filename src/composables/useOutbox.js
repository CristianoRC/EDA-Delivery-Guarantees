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
    log.push(`📤 Producer: BEGIN tx — credit $${amount} + INSERT INTO outbox (${idempotencyKey})`, 'info')

    if (store.fails.dbCommit && Math.random() < DB_COMMIT_FAIL_RATE) {
      await animateMsg('producer', 'outbox', label, '', true)
      store.crash('outbox')
      log.push(`❌ DB: COMMIT failed — ROLLBACK on ${idempotencyKey}. No outbox row, no balance change (atomic guarantee)`, 'danger')
      store.stats.lost++
      return
    }

    await animateMsg('producer', 'outbox', label, '')
    store.flash('outbox')
    store.stats.expected += amount
    store.outboxRows.push({ id: logicalId, idempotencyKey, amount, label, attempts: 0 })
    store.stats.outboxPending = store.outboxRows.length
    log.push(`✅ DB: COMMIT — business state + outbox row persisted atomically`, 'ok')

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

    while (store.isOutbox && store.outboxRows.length > 0) {
      const row = store.outboxRows[0]
      const crashed = await publishRow(row)
      if (crashed) break
      removeRow(row)
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

    while (store.isOutbox && store.outboxRows.length > 0) {
      const row = store.outboxRows[0]
      store.setPhase(`CDC: streaming change for ${row.idempotencyKey}`)
      log.push(`🛰️ CDC: WAL change captured for ${row.idempotencyKey}`, 'info')
      const crashed = await publishRow(row)
      if (crashed) break
      removeRow(row)
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

  async function publishRow(row) {
    row.attempts++
    store.setPhase(`Relay → Broker: ${row.idempotencyKey} (attempt ${row.attempts})`)
    store.flash('outbox')
    store.stats.physicalSent++

    const cls = row.attempts > 1 ? 'dup' : ''
    await animateMsg('outbox', 'broker', row.label, cls)
    store.flash('broker')
    log.push(`📨 Broker: received ${row.idempotencyKey}${row.attempts > 1 ? ` (republish #${row.attempts})` : ''}`, 'dim')
    store.stats.queue++
    await sleep(150)

    const willCrash = store.fails.relayCrash && Math.random() < RELAY_CRASH_RATE
    if (willCrash) {
      store.crash('outbox')
      log.push(`💥 Relay crashed BEFORE marking ${row.idempotencyKey} as published — row stays pending, broker already has the message`, 'danger')
    }

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
