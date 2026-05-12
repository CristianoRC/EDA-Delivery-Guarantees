<template>
  <main class="stage">
    <div
      ref="stageEl"
      class="stage-grid"
      :class="{ 'dlq-mode': store.scenarioConfig.showDLQ }"
    >
      <pipeline-node
        variant="producer"
        icon="📤"
        label="PRODUCER"
        stat-label="published"
        :stat-value="store.stats.physicalSent"
      />
      <div class="arrow">→</div>
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

      <div ref="layerEl" class="msg-layer" />
    </div>

    <app-bottom-bar />
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import PipelineNode from './PipelineNode.vue'
import AppBottomBar from './AppBottomBar.vue'
import { useSimulatorStore } from '@/stores/simulator'
import { registerStage, registerLayer } from '@/composables/useAnimation'

const store = useSimulatorStore()
const stageEl = ref(null)
const layerEl = ref(null)

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
}

.arrow {
  font-size: 24px;
  color: var(--border);
}
</style>
