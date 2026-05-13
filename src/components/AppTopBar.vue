<template>
  <header class="topbar">
    <div class="brand">
      <span class="logo" aria-hidden="true">
        <svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
          <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#38bdf8" />
              <stop offset="1" stop-color="#a78bfa" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#logoGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1.5" y="1.5" width="29" height="21" rx="2" />
            <path d="M1.5 4.5 L16 14 L30.5 4.5" />
          </g>
        </svg>
      </span>
      <div>
        <h1>EDA Simulator</h1>
        <p class="subtitle">Event-Driven Architecture patterns, visualized</p>
      </div>
    </div>

    <div class="topbar-controls">
      <div class="control-group">
        <label>Tool</label>
        <div class="tool-select-wrap">
          <Icon :icon="store.toolConfig.icon" class="tool-select-icon" />
          <select
            class="select tool-select"
            :value="store.tool"
            @change="onToolChange"
          >
            <optgroup v-for="group in TOOL_GROUPS" :key="group" :label="group">
              <option
                v-for="(t, id) in toolsByGroup(group)"
                :key="id"
                :value="id"
                :disabled="!store.isToolSupported(id)"
              >
                {{ store.isToolSupported(id) ? t.name : `${t.name} (not native)` }}
              </option>
            </optgroup>
          </select>
        </div>
      </div>

      <div class="control-group">
        <label>Speed</label>
        <select
          class="select small"
          :value="store.speed"
          @change="store.speed = Number($event.target.value)"
        >
          <option v-for="s in SPEEDS" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </div>

      <button
        class="btn btn-icon"
        @click="store.reset()"
        title="Reset"
        aria-label="Reset"
      >
        <Icon :icon="ICONS.reset" />
      </button>

      <a
        class="btn btn-ghost btn-icon github-link"
        href="https://github.com/CristianoRC/EDA-Simulator"
        target="_blank"
        rel="noopener noreferrer"
        title="Source on GitHub · by Cristiano Cunha"
        aria-label="Source on GitHub"
      >
        <Icon :icon="ICONS.github" />
      </a>
    </div>
  </header>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { useSimulatorStore } from '@/stores/simulator'
import { TOOLS, TOOL_GROUPS } from '@/config/tools'
import { SPEEDS } from '@/config/scenarios'
import { ICONS } from '@/config/icons'

const store = useSimulatorStore()

function toolsByGroup(group) {
  return Object.fromEntries(
    Object.entries(TOOLS).filter(([, t]) => t.group === group),
  )
}

function onToolChange(e) {
  const id = e.target.value
  if (!store.isToolSupported(id)) return
  store.setTool(id)
}
</script>

<style lang="scss" scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 16px;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
}

.brand { display: flex; align-items: center; gap: 12px; }
.logo { display: inline-flex; align-items: center; }
.logo svg { height: 24px; width: auto; display: block; }
.brand h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.2px; }
.subtitle { margin: 1px 0 0 0; font-size: 11px; color: var(--text-dim); }

.topbar-controls {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  flex-wrap: wrap;
}

.control-group { display: flex; flex-direction: column; gap: 3px; }
.control-group > label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--text-dimmer);
  font-weight: 700;
}

.select {
  background: var(--bg-panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  min-width: 180px;
  &.small { min-width: 110px; }
}

.tool-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.tool-select-icon {
  position: absolute;
  left: 8px;
  font-size: 16px;
  pointer-events: none;
  z-index: 1;
  color: var(--text-dim);
}
.tool-select { padding-left: 30px; }

.btn {
  background: var(--bg-panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: var(--accent); }
  &.btn-ghost { background: transparent; }
  &.btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    color: var(--text-dim);
    font-size: 16px;
    line-height: 0;
    text-decoration: none;
    &:hover { color: var(--text); }
  }
}
</style>
