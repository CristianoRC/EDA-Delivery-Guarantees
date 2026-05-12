<template>
  <main class="stage">
    <div
      ref="stageEl"
      class="stage-grid"
      :class="{
        'dlq-mode': store.scenarioConfig.showDLQ,
        'outbox-mode': store.scenarioConfig.showOutbox,
        'inbox-mode': store.scenarioConfig.showInbox,
      }"
    >
      <pipeline-node
        variant="producer"
        :icon="ICONS.producer"
        label="PRODUCER"
        :desc="store.isOutbox ? 'Writes business + outbox' : ''"
        stat-label="published"
        :stat-value="store.stats.physicalSent"
      />
      <div class="arrow">→</div>

      <template v-if="store.scenarioConfig.showOutbox">
        <pipeline-node
          variant="outbox"
          :icon="ICONS.sourceDb"
          label="SOURCE DB"
          desc="business + outbox table"
          stat-label="pending"
          :stat-value="store.stats.outboxPending"
          stat-class="outbox-stat"
        />
        <div class="arrow">→</div>
      </template>

      <pipeline-node
        variant="broker"
        :icon="store.toolConfig.icon"
        :label="store.toolConfig.brokerLabel"
        :desc="store.toolConfig.brokerDesc"
        stat-label="in queue"
        :stat-value="store.stats.queue"
      />
      <div class="arrow">→</div>
      <pipeline-node
        variant="consumer"
        :icon="ICONS.consumer"
        label="CONSUMER"
        :desc="store.isInbox ? 'dedup via inbox + atomic write' : ''"
        stat-label="processed"
        :stat-value="store.stats.processed"
      />
      <div class="arrow">→</div>

      <template v-if="store.scenarioConfig.showInbox">
        <pipeline-node
          variant="inbox"
          :icon="ICONS.inbox"
          label="INBOX"
          desc="processed message_ids"
          stat-label="rows"
          :stat-value="store.stats.inboxRows"
          stat-class="inbox-stat"
        />
        <div class="arrow">→</div>
      </template>

      <pipeline-node
        variant="db"
        :icon="ICONS.db"
        label="DATABASE"
        desc="John's balance"
        stat-label="balance"
        :stat-value="`$ ${store.stats.balance}`"
        stat-class="balance"
      />

      <div v-show="store.scenarioConfig.showDLQ" class="dlq-arrow">↓</div>
      <pipeline-node
        v-show="store.scenarioConfig.showDLQ"
        variant="dlq"
        :icon="ICONS.dlq"
        label="DEAD LETTER"
        desc="Poison messages"
        stat-label="dead-lettered"
        :stat-value="store.stats.deadLettered"
        stat-class="dlq-stat"
      />

      <template v-if="store.scenarioConfig.showOutbox">
        <pipeline-node
          variant="relay"
          :icon="relayIcon"
          :label="relayLabel"
          :desc="relayDesc"
          stat-label="published"
          :stat-value="store.stats.outboxPublished"
          stat-class="outbox-stat"
        />
        <div class="relay-arrow">
          <span class="relay-line">{{ relayLineLabel }}</span>
          <span class="relay-tip">↓</span>
        </div>
      </template>

      <template v-if="store.scenarioConfig.showInbox">
        <div class="inbox-banner">
          <span class="inbox-banner-line">
            <Icon :icon="ICONS.idempotency" class="inbox-banner-icon" />
            atomic tx: INSERT inbox + UPDATE balance
          </span>
        </div>
      </template>

      <div ref="layerEl" class="msg-layer" />
    </div>

    <app-bottom-bar />
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import PipelineNode from './PipelineNode.vue'
import AppBottomBar from './AppBottomBar.vue'
import { useSimulatorStore } from '@/stores/simulator'
import { registerStage, registerLayer } from '@/composables/useAnimation'
import { ICONS } from '@/config/icons'

const store = useSimulatorStore()
const stageEl = ref(null)
const layerEl = ref(null)

const isCDC = computed(() => store.outboxMode === 'cdc')
const relayIcon = computed(() => isCDC.value ? ICONS.relayCdc : ICONS.relayPolling)
const relayLabel = computed(() => isCDC.value ? 'CDC CONNECTOR' : 'POLLING WORKER')
const relayDesc = computed(() => isCDC.value ? 'tails the transaction log' : 'SELECT outbox @ 1.5s')
const relayLineLabel = computed(() => isCDC.value ? 'tx-log stream' : 'SELECT … WHERE pending')

onMounted(() => {
  registerStage(stageEl.value)
  registerLayer(layerEl.value)
})
</script>

<style lang="scss" scoped>
.stage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  min-width: 0;
  padding-bottom: 108px;
}

.stage-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  grid-template-rows: 1fr;
  align-items: center;
  gap: 6px;
  padding: 18px 14px;
  flex: 1;
  min-height: 0;
  background:
    radial-gradient(ellipse at center, rgba(56,189,248,0.04), transparent 60%),
    linear-gradient(180deg, rgba(31,42,68,0.3), rgba(15,23,42,0.3));
  border-radius: 14px;
  border: 1px solid var(--border-soft);

  &.dlq-mode {
    grid-template-rows: 1fr auto 1fr;
    .dlq-arrow {
      grid-column: 3;
      grid-row: 2;
      text-align: center;
      font-size: 20px;
      color: var(--dlq);
    }
    :deep(.node-dlq) {
      grid-column: 3;
      grid-row: 3;
    }
  }

  &.outbox-mode {
    grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1fr;
    grid-template-rows: auto auto 1fr;
    gap: 4px 6px;

    :deep(.node-producer),
    :deep(.node-outbox),
    :deep(.node-broker),
    :deep(.node-consumer),
    :deep(.node-db) { grid-row: 3; }
    .arrow { grid-row: 3; }

    :deep(.node-relay) {
      grid-column: 3;
      grid-row: 1;
    }
    .relay-arrow {
      grid-column: 3;
      grid-row: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 4px 0;
    }
    .relay-line {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--outbox);
      font-weight: 700;
      background: rgba(167, 139, 250, 0.12);
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(167, 139, 250, 0.3);
    }
    .relay-tip {
      color: var(--outbox);
      font-size: 18px;
      line-height: 1;
    }
  }

  &.inbox-mode {
    grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1fr;
    grid-template-rows: auto 1fr;
    gap: 4px 6px;

    :deep(.node-producer),
    :deep(.node-broker),
    :deep(.node-consumer),
    :deep(.node-inbox),
    :deep(.node-db) { grid-row: 2; }
    .arrow { grid-row: 2; }

    .inbox-banner {
      grid-column: 5 / span 5;
      grid-row: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 0 4px 0;
    }
    .inbox-banner-line {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--inbox);
      font-weight: 700;
      background: rgba(94, 234, 212, 0.12);
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid rgba(94, 234, 212, 0.3);
    }
    .inbox-banner-icon { font-size: 12px; }
  }
}

.arrow {
  font-size: 24px;
  color: var(--border);
}
</style>
