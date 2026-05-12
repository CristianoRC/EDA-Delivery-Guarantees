<template>
  <section class="card card-fails">
    <header class="card-header">
      <span class="card-title">Inject failures</span>
      <span class="card-sub">{{ store.isOutbox ? 'outbox-specific' : 'real-world simulation' }}</span>
    </header>
    <div class="failures-grid">
      <label v-for="chip in chips" :key="chip.key" class="fail-chip">
        <input type="checkbox" v-model="store.fails[chip.key]" />
        <span>{{ chip.label }}</span>
      </label>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'
const store = useSimulatorStore()

const DEFAULT_CHIPS = [
  { key: 'producer', label: '📤 Producer 10%' },
  { key: 'network', label: '📡 Network 15%' },
  { key: 'ack', label: '✉️ ACK 20%' },
  { key: 'consumer', label: '💥 Crash 15%' },
]

const OUTBOX_CHIPS = [
  { key: 'dbCommit', label: '💾 DB commit 25%' },
  { key: 'relayCrash', label: '🛰️ Relay crash 40%' },
]

const chips = computed(() => store.isOutbox ? OUTBOX_CHIPS : DEFAULT_CHIPS)
</script>

<style lang="scss" scoped>
@use '@/components/_card' as *;

.failures-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.fail-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: var(--danger); }
  input { accent-color: var(--danger); margin: 0; }
  input:checked + span { color: var(--danger); font-weight: 600; }
}
</style>
