<template>
  <div
    ref="nodeEl"
    class="node"
    :class="[
      `node-${variant}`,
      { flash: store.flashing[variant], crash: store.crashing[variant] },
    ]"
  >
    <div class="node-icon"><Icon :icon="icon" /></div>
    <div class="node-label">{{ label }}</div>
    <div class="node-desc" :class="{ 'is-placeholder': !desc }">{{ desc || ' ' }}</div>
    <div class="node-stat" :class="statClass">
      <span>{{ statLabel }}</span>
      <b>{{ statValue }}</b>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useSimulatorStore } from '@/stores/simulator'
import { registerNode } from '@/composables/useAnimation'

const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (v) => ['producer', 'broker', 'consumer', 'db', 'dlq', 'outbox', 'relay', 'inbox'].includes(v),
  },
  icon: { type: String, required: true },
  label: { type: String, required: true },
  desc: { type: String, default: '' },
  statLabel: { type: String, required: true },
  statValue: { type: [String, Number], required: true },
  statClass: { type: String, default: '' },
})

const store = useSimulatorStore()
const nodeEl = ref(null)

onMounted(() => {
  registerNode(props.variant, nodeEl.value)
})
</script>

<style lang="scss" scoped>
.node {
  background: var(--bg-panel);
  border: 2px solid var(--border);
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.3s;
  position: relative;

  &.node-producer { border-color: var(--producer); .node-icon { color: var(--producer); } }
  &.node-broker { border-color: var(--broker); .node-icon { color: var(--broker); } }
  &.node-consumer { border-color: var(--consumer); .node-icon { color: var(--consumer); } }
  &.node-db { border-color: var(--db); .node-icon { color: var(--db); } }
  &.node-dlq { border-color: var(--dlq); .node-icon { color: var(--dlq); } }
  &.node-outbox { border-color: var(--outbox); .node-icon { color: var(--outbox); } }
  &.node-relay {
    border-color: var(--outbox);
    border-style: dashed;
    .node-icon { color: var(--outbox); }
  }
  &.node-inbox { border-color: var(--inbox); .node-icon { color: var(--inbox); } }

  &.flash { animation: flash 0.6s ease; }
  &.crash { animation: crash 0.6s ease; }
}

.node-icon {
  font-size: 32px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;

  :deep(svg) {
    width: 32px;
    height: 32px;
    display: block;
  }
}
.node-label {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text);
}
.node-desc {
  font-size: 10px;
  color: var(--text-dimmer);
  margin-top: -2px;
  min-height: 1em;
  line-height: 1;

  &.is-placeholder { visibility: hidden; }
}
.node-stat {
  margin-top: 6px;
  padding: 5px 12px;
  background: var(--bg-panel-2);
  border-radius: 6px;
  font-size: 10px;
  min-width: 100px;

  span {
    display: block;
    text-transform: uppercase;
    font-size: 8px;
    letter-spacing: 0.5px;
    color: var(--text-dimmer);
    font-weight: 600;
  }
  b {
    color: var(--text);
    font-size: 16px;
    display: block;
  }
  &.balance b { color: var(--ok); font-size: 18px; }
  &.dlq-stat b { color: var(--dlq); font-size: 18px; }
  &.outbox-stat b { color: var(--outbox); font-size: 18px; }
  &.inbox-stat b { color: var(--inbox); font-size: 18px; }
}

@keyframes flash {
  0% { transform: scale(1); }
  50% { transform: scale(1.06); }
  100% { transform: scale(1); }
}
@keyframes crash {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px) rotate(-1.5deg); }
  40% { transform: translateX(6px) rotate(1.5deg); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}
</style>
