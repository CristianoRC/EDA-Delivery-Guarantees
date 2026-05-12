<template>
  <v-app>
    <app-top-bar />
    <div class="main-layout">
      <app-side-bar />
      <simulation-stage />
    </div>
    <event-log />
  </v-app>
</template>

<script setup>
import AppTopBar from '@/components/AppTopBar.vue'
import ToolInfoBanner from '@/components/ToolInfoBanner.vue'
import AppSideBar from '@/components/AppSideBar.vue'
import SimulationStage from '@/components/SimulationStage.vue'
import EventLog from '@/components/EventLog.vue'
import { useSimulatorStore } from '@/stores/simulator'
import { useLogStore } from '@/stores/log'
import { onMounted } from 'vue'

onMounted(() => {
  const log = useLogStore()
  log.push('✨ Simulator ready.', 'info')
})
</script>

<style lang="scss">
.main-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 12px;
  padding: 12px;
  flex: 1;
  min-height: 0;
}

// Global message-layer styling — kept global since elements are appended imperatively.
.msg-layer { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.msg {
  position: absolute;
  background: var(--accent);
  color: #0b1220;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 999px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 3px rgba(56,189,248,0.3);
  white-space: nowrap;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 6px;

  .msg-icon {
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }

  &.poison { background: #fb7185; color: white; }
  &.retry { background: var(--warn); }
  &.dup { background: var(--warn); }
  &.ack { background: var(--ok); }
  &.lost { background: var(--danger); color: white; }
  &.dead {
    background: var(--dlq); color: white;
    box-shadow: 0 4px 20px rgba(239,68,68,0.5), 0 0 0 3px rgba(239,68,68,0.3);
  }
  &.query {
    background: rgba(167, 139, 250, 0.85);
    color: #0b1220;
    box-shadow: 0 4px 20px rgba(167,139,250,0.5), 0 0 0 3px rgba(167,139,250,0.25);
  }
}
</style>
