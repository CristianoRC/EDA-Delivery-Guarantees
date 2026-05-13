<template>
  <section class="card card-fails">
    <header class="card-header">
      <span class="card-title">Inject failures</span>
      <span class="card-sub">{{ subTitle }}</span>
    </header>
    <div class="failures-grid">
      <label v-for="chip in chips" :key="chip.key" class="fail-chip">
        <input type="checkbox" v-model="store.fails[chip.key]" />
        <Icon :icon="chip.icon" class="fail-chip-icon" />
        <span>{{ chip.label }}</span>
      </label>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useSimulatorStore } from '@/stores/simulator'
import { ICONS } from '@/config/icons'
const store = useSimulatorStore()

const DEFAULT_CHIPS = [
  { key: 'producer', icon: ICONS.producer, label: 'Producer 10%' },
  { key: 'network', icon: ICONS.network, label: 'Network 15%' },
  { key: 'ack', icon: ICONS.ackFail, label: 'ACK 20%' },
  { key: 'consumer', icon: ICONS.crash, label: 'Crash 15%' },
  { key: 'consumerDown', icon: ICONS.consumerDown, label: 'Consumer down' },
  { key: 'consumerOverload', icon: ICONS.consumerOverload, label: 'Overload 25%' },
]

const OUTBOX_CHIPS = [
  { key: 'dbCommit', icon: ICONS.dbCommitFail, label: 'DB commit 25%' },
  { key: 'relayCrash', icon: ICONS.relayPolling, label: 'Relay crash 40%' },
]

const INBOX_CHIPS = [
  { key: 'txAbort', icon: ICONS.txAbort, label: 'Tx abort 25%' },
  { key: 'ackLost', icon: ICONS.ackFail, label: 'ACK lost 40%' },
]

const chips = computed(() => {
  if (store.isOutbox) return OUTBOX_CHIPS
  if (store.isInbox) return INBOX_CHIPS
  return DEFAULT_CHIPS
})

const subTitle = computed(() => {
  if (store.isOutbox) return 'outbox-specific'
  if (store.isInbox) return 'inbox-specific'
  return 'real-world simulation'
})
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
  .fail-chip-icon {
    font-size: 14px;
    color: var(--text-dim);
    flex-shrink: 0;
  }
  input:checked ~ span { color: var(--danger); font-weight: 600; }
  input:checked ~ .fail-chip-icon { color: var(--danger); }
}
</style>
