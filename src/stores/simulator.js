import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { TOOLS } from '@/config/tools'
import { SCENARIOS } from '@/config/scenarios'
import { useLogStore } from './log'

export const useSimulatorStore = defineStore('simulator', () => {
  const log = useLogStore()

  const scenario = ref('at-least-once')
  const tool = ref('servicebus')
  const speed = ref(1400)
  const idempotency = ref(false)
  const maxDeliveryCount = ref(3)
  const poisonRate = ref(30)
  const outboxMode = ref('polling')

  const fails = reactive({
    producer: false,
    network: false,
    ack: false,
    consumer: false,
    dbCommit: false,
    relayCrash: false,
    txAbort: false,
    ackLost: false,
  })

  const stats = reactive({
    logicalSent: 0,
    physicalSent: 0,
    delivered: 0,
    duplicated: 0,
    lost: 0,
    deadLettered: 0,
    balance: 0,
    expected: 0,
    queue: 0,
    processed: 0,
    outboxPending: 0,
    outboxPublished: 0,
    inboxRows: 0,
    inboxDedups: 0,
    txRollbacks: 0,
    msgIdCounter: 0,
  })

  const processedKeys = new Set()
  const brokerSeen = new Set()
  const outboxRows = reactive([])
  const inboxKeys = reactive(new Set())

  const phase = ref('Ready')
  const phaseActive = ref(false)
  let phaseTimer = null

  const flashing = reactive({
    producer: false,
    broker: false,
    consumer: false,
    db: false,
    dlq: false,
    outbox: false,
    relay: false,
    inbox: false,
  })
  const crashing = reactive({
    producer: false,
    broker: false,
    consumer: false,
    db: false,
    dlq: false,
    outbox: false,
    relay: false,
    inbox: false,
  })

  const scenarioConfig = computed(() => SCENARIOS[scenario.value])
  const toolConfig = computed(() => TOOLS[tool.value])
  const mode = computed(() => scenarioConfig.value.mode)

  const isDLQ = computed(() => scenario.value === 'dlq')
  const isOutbox = computed(() => scenario.value === 'outbox')
  const isInbox = computed(() => scenario.value === 'inbox')
  const balanceDiff = computed(() => stats.balance - stats.expected)

  function setPhase(text) {
    phase.value = text
    phaseActive.value = true
    if (phaseTimer) clearTimeout(phaseTimer)
    phaseTimer = setTimeout(() => { phaseActive.value = false }, 1500)
  }

  function flash(node) {
    flashing[node] = true
    setTimeout(() => { flashing[node] = false }, 600)
  }

  function crash(node) {
    crashing[node] = true
    setTimeout(() => { crashing[node] = false }, 600)
  }

  function setScenario(id) {
    scenario.value = id
    const sc = SCENARIOS[id]
    if (!sc.showIdempotency) idempotency.value = false

    const currentTool = TOOLS[tool.value]
    const valid = sc.showDLQ
      ? currentTool.supportsDLQ
      : currentTool.supports.includes(sc.mode)
    if (!valid) tool.value = sc.defaultTool

    reset()
    log.push(`🎯 Scenario: ${sc.name} (mode: ${sc.mode})`, 'info')
  }

  function setTool(id) {
    tool.value = id
    log.push(`🔧 Tool: ${TOOLS[id].name}`, 'info')
  }

  function setIdempotency(val) {
    idempotency.value = val
    log.push(`🛡️ Idempotency: ${val ? 'ENABLED' : 'DISABLED'}`, 'info')
  }

  function setOutboxMode(val) {
    outboxMode.value = val
    log.push(`🛰️ Outbox relay: ${val === 'cdc' ? 'CDC, tails the DB transaction log' : 'Polling, SELECT outbox at fixed interval'}`, 'info')
  }

  function isToolSupported(toolId) {
    const t = TOOLS[toolId]
    const sc = SCENARIOS[scenario.value]
    return sc.showDLQ ? t.supportsDLQ : t.supports.includes(sc.mode)
  }

  function reset() {
    Object.assign(stats, {
      logicalSent: 0,
      physicalSent: 0,
      delivered: 0,
      duplicated: 0,
      lost: 0,
      deadLettered: 0,
      balance: 0,
      expected: 0,
      queue: 0,
      processed: 0,
      outboxPending: 0,
      outboxPublished: 0,
      inboxRows: 0,
      inboxDedups: 0,
      txRollbacks: 0,
      msgIdCounter: 0,
    })
    processedKeys.clear()
    brokerSeen.clear()
    outboxRows.splice(0, outboxRows.length)
    inboxKeys.clear()
    log.reset()
    setPhase('Ready')
    log.push('🔄 Simulation reset', 'info')
  }

  function nextMsgId() {
    return ++stats.msgIdCounter
  }

  return {
    scenario, tool, speed, idempotency, maxDeliveryCount, poisonRate, outboxMode,
    fails, stats, processedKeys, brokerSeen, outboxRows, inboxKeys,
    phase, phaseActive, flashing, crashing,
    scenarioConfig, toolConfig, mode, isDLQ, isOutbox, isInbox, balanceDiff,
    setPhase, flash, crash, setScenario, setTool, setIdempotency, setOutboxMode,
    isToolSupported, reset, nextMsgId,
  }
})
