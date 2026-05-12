<template>
  <main class="stage">
    <div
      ref="stageEl"
      class="stage-grid"
      :class="{
        'dlq-mode': store.scenarioConfig.showDLQ,
        'outbox-mode': store.scenarioConfig.showOutbox,
      }"
    >
      <pipeline-node
        variant="producer"
        icon="📤"
        label="PRODUCER"
        :desc="store.isOutbox ? 'Writes business + outbox' : ''"
        stat-label="published"
        :stat-value="store.stats.physicalSent"
      />
      <div class="arrow">→</div>

      <template v-if="store.scenarioConfig.showOutbox">
        <pipeline-node
          variant="outbox"
          icon="🗄️"
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
        icon="📨"
        :label="store.toolConfig.brokerLabel"
        :desc="store.toolConfig.brokerDesc"
        stat-label="in queue"
        :stat-value="store.stats.queue"
      />
      <div class="arrow">→</div>
      <pipeline-node
        variant="consumer"
        icon="⚙️"
        label="CONSUMER"
        stat-label="processed"
        :stat-value="store.stats.processed"
      />
      <div class="arrow">→</div>
      <pipeline-node
        variant="db"
        icon="💾"
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
        icon="🪦"
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

      <div ref="layerEl" class="msg-layer" />
    </div>

    <app-bottom-bar />
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PipelineNode from './PipelineNode.vue'
import AppBottomBar from './AppBottomBar.vue'
import { useSimulatorStore } from '@/stores/simulator'
import { registerStage, registerLayer } from '@/composables/useAnimation'

const store = useSimulatorStore()
const stageEl = ref(null)
const layerEl = ref(null)

const isCDC = computed(() => store.outboxMode === 'cdc')
const relayIcon = computed(() => isCDC.value ? '⚡' : '🔄')
const relayLabel = computed(() => isCDC.value ? 'DEBEZIUM / CDC' : 'POLLING WORKER')
const relayDesc = computed(() => isCDC.value ? 'reads WAL near-realtime' : 'SELECT outbox @ 1.5s')
const relayLineLabel = computed(() => isCDC.value ? 'WAL stream' : 'SELECT … WHERE pending')

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
}

.arrow {
  font-size: 24px;
  color: var(--border);
}
</style>
