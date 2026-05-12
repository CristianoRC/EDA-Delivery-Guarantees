<template>
  <div class="tool-info">
    <strong>{{ store.toolConfig.name }}</strong>: <span v-html="store.toolConfig.desc" />
  </div>
</template>

<script setup>
import { useSimulatorStore } from '@/stores/simulator'
const store = useSimulatorStore()
</script>

<style lang="scss" scoped>
.tool-info {
  padding: 6px 20px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-dim);
  background: linear-gradient(90deg, rgba(0,120,212,0.12), transparent);
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  :deep(strong) { color: var(--text); }
  :deep(code) {
    background: var(--bg-panel-2);
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10.5px;
    color: var(--accent);
  }
}
</style>
