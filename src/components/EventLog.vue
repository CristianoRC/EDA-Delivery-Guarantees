<template>
  <div class="log-wrapper" :class="{ open: isOpen, maximized: isMaximized }">
    <div
      v-if="isOpen"
      class="log-panel"
      :style="!isMaximized ? { height: height + 'px' } : null"
    >
      <div
        v-if="!isMaximized"
        class="log-resize-handle"
        @mousedown.prevent="startResize"
        title="Drag to resize"
      ></div>
      <div ref="logEl" class="log">
        <div v-for="entry in log.entries" :key="entry.id" class="log-entry">
          <span class="log-time">[{{ entry.time }}s]</span>
          <span class="log-msg" :class="entry.level">{{ entry.msg }}</span>
        </div>
      </div>
    </div>

    <div
      class="log-summary"
      :class="{ 'is-open': isOpen }"
      role="button"
      tabindex="0"
      :aria-expanded="isOpen"
      @click="toggleOpen"
      @keydown.enter.prevent="toggleOpen"
      @keydown.space.prevent="toggleOpen"
    >
      <svg class="log-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="log-title">📜 Event log</span>
      <span v-if="log.entries.length" class="log-count">{{ log.entries.length }}</span>

      <span v-if="!isOpen && lastEntry" class="log-peek" :class="lastEntry.level">
        <span class="log-peek-time">[{{ lastEntry.time }}s]</span>
        {{ lastEntry.msg }}
      </span>

      <span class="log-spacer"></span>

      <span v-if="!isOpen" class="log-hint">Click to expand</span>

      <button
        v-if="isOpen"
        type="button"
        class="log-btn"
        @click.stop="toggleMaximize"
        :title="isMaximized ? 'Restore' : 'Maximize'"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
      >
        <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="3" y="1.5" width="7.5" height="7.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <rect x="1.5" y="3" width="7.5" height="7.5" rx="1" fill="#060a14" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>

      <button
        v-if="isOpen"
        type="button"
        class="log-btn log-btn-close"
        @click.stop="closeLog"
        title="Close"
        aria-label="Close"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3 L9 9 M9 3 L3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onBeforeUnmount } from 'vue'
import { useLogStore } from '@/stores/log'

const log = useLogStore()
const logEl = ref(null)

const lastEntry = computed(() => log.entries[log.entries.length - 1] || null)

const STORAGE_KEY = 'eventlog:height'
const MIN_HEIGHT = 80
const DEFAULT_HEIGHT = 200

const isOpen = ref(false)
const isMaximized = ref(false)
const height = ref(loadHeight())

function loadHeight() {
  const raw = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(raw) && raw >= MIN_HEIGHT ? raw : DEFAULT_HEIGHT
}

function maxHeight() {
  return Math.max(MIN_HEIGHT, window.innerHeight - 140)
}

async function scrollToBottom() {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}

function toggleOpen() {
  isOpen.value = !isOpen.value
  if (!isOpen.value) isMaximized.value = false
  if (isOpen.value) scrollToBottom()
}

function toggleMaximize() {
  isMaximized.value = !isMaximized.value
  scrollToBottom()
}

function closeLog() {
  isOpen.value = false
  isMaximized.value = false
}

let dragStartY = 0
let dragStartH = 0

function startResize(e) {
  dragStartY = e.clientY
  dragStartH = height.value
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  const dy = dragStartY - e.clientY
  const next = Math.min(maxHeight(), Math.max(MIN_HEIGHT, dragStartH + dy))
  height.value = next
}

function stopResize() {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  localStorage.setItem(STORAGE_KEY, String(height.value))
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})

watch(
  () => log.entries.length,
  () => {
    if (isOpen.value) scrollToBottom()
  },
)
</script>

<style lang="scss" scoped>
.log-wrapper {
  position: relative;
  flex-shrink: 0;
  z-index: 50;
}

/* When maximized, the wrapper itself becomes a fullscreen overlay below the top bar.
   This guarantees the summary bar (with close/restore buttons) is always visible. */
.log-wrapper.maximized {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: #060a14;
}

.log-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 20px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  user-select: none;
  background: linear-gradient(180deg, var(--bg-panel), var(--bg-panel-2, #0b1424));
  border: none;
  border-top: 1px solid var(--border);
  text-align: left;
  font-family: inherit;
  transition: color 0.15s, background 0.15s;
  box-sizing: border-box;

  &:hover {
    color: var(--text);
    background: linear-gradient(180deg, var(--bg-panel-2, #0b1424), var(--bg-panel-2, #0b1424));
  }

  &:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -2px;
  }
}

.log-wrapper.maximized .log-summary { order: 2; }

.log-caret {
  color: var(--text-dimmer);
  flex-shrink: 0;
  transition: transform 0.2s;
  .log-summary.is-open & { transform: rotate(180deg); color: var(--accent); }
}

.log-title { flex-shrink: 0; }

.log-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text);
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 999px;
  flex-shrink: 0;
}

.log-peek {
  font-family: "SF Mono", Menlo, monospace;
  font-weight: 400;
  font-size: 10.5px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  opacity: 0.85;

  &.ok { color: var(--ok); }
  &.warn { color: var(--warn); }
  &.danger { color: var(--danger); }
  &.info { color: var(--accent); }
}

.log-peek-time { color: var(--text-dimmer); margin-right: 4px; }

.log-spacer { flex: 1; min-width: 8px; }

.log-hint {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dimmer);
  letter-spacing: 0.3px;
  flex-shrink: 0;
  .log-summary:hover & { color: var(--accent); }
}

.log-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  transition: all 0.15s;
  flex-shrink: 0;

  &:hover { color: var(--text); border-color: var(--accent); }
  &:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
}

.log-btn-close:hover { color: var(--danger); border-color: var(--danger); }

/* Expanded panel floats above the content, anchored on top of the summary bar.
   The summary itself stays in flow as the page footer. */
.log-panel {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  background: #060a14;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.45);
}

/* In maximized mode the wrapper covers the viewport; panel fills it with flex. */
.log-wrapper.maximized .log-panel {
  position: static;
  flex: 1;
  min-height: 0;
  border-bottom: 1px solid var(--border);
  box-shadow: none;
  order: 1;
}

.log-resize-handle {
  height: 5px;
  cursor: ns-resize;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.15s;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 36px;
    height: 2px;
    border-radius: 2px;
    background: var(--border);
    transition: background 0.15s;
  }

  &:hover {
    background: rgba(56, 189, 248, 0.1);
    &::after { background: var(--accent); }
  }
}

.log {
  font-family: "SF Mono", Menlo, monospace;
  font-size: 11px;
  line-height: 1.6;
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px;
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
