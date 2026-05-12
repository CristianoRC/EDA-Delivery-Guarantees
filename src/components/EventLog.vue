<template>
  <details class="log-wrapper" ref="wrapper">
    <summary>📜 Event log</summary>
    <div ref="logEl" class="log">
      <div v-for="entry in log.entries" :key="entry.id" class="log-entry">
        <span class="log-time">[{{ entry.time }}s]</span>
        <span class="log-msg" :class="entry.level">{{ entry.msg }}</span>
      </div>
    </div>
  </details>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const logEl = ref(null)

watch(
  () => log.entries.length,
  async () => {
    await nextTick()
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  },
)
</script>

<style lang="scss" scoped>
.log-wrapper {
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  flex-shrink: 0;

  summary {
    padding: 6px 20px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-dim);
    list-style: none;
    user-select: none;
    &::-webkit-details-marker { display: none; }
    &::before { content: "▸ "; }
  }
  &[open] summary::before { content: "▾ "; }
}

.log {
  font-family: "SF Mono", Menlo, monospace;
  font-size: 11px;
  line-height: 1.6;
  max-height: 160px;
  overflow-y: auto;
  padding: 8px 20px;
  background: #060a14;
  border-top: 1px solid var(--border-soft);
}

.log-entry { display: flex; gap: 10px; }
.log-time { color: var(--text-dimmer); flex-shrink: 0; min-width: 56px; }
.log-msg {
  &.ok { color: var(--ok); }
  &.warn { color: var(--warn); }
  &.danger { color: var(--danger); }
  &.info { color: var(--accent); }
  &.dim { color: var(--text-dim); }
}
</style>
