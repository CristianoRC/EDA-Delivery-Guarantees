<template>
  <component
    :is="disabled ? 'div' : 'button'"
    class="scenario-item"
    :class="{ active, disabled }"
    :title="disabled ? 'Coming soon' : null"
    @click="!disabled && $emit('select')"
  >
    <span class="scenario-icon">{{ icon }}</span>
    <span class="scenario-text">
      <strong>{{ title }}</strong>
      <small>{{ blurb }}</small>
    </span>
  </component>
</template>

<script setup>
defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
  blurb: { type: String, required: true },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<style lang="scss" scoped>
.scenario-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(31, 42, 68, 0.4);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  color: var(--text-dim);
  width: 100%;
  outline: none;
  font-family: inherit;

  &:focus { outline: none; }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  &:hover:not(.disabled) {
    border-color: var(--accent);
    background: var(--bg-panel-2);
    color: var(--text);
  }
  &.active {
    background: linear-gradient(135deg, rgba(56,189,248,0.18), rgba(167,139,250,0.12));
    border-color: var(--accent);
    border-width: 2px;
    padding: 9px 11px;
    box-shadow: 0 0 18px rgba(56,189,248,0.25);
    color: var(--text);
    .scenario-text strong { color: var(--accent); }
    .scenario-icon { transform: scale(1.1); }
  }
  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
    background: transparent;
    border-style: dashed;
    border-color: var(--border);
    .scenario-text strong { color: var(--text-dim); }
  }
  .scenario-icon { transition: transform 0.2s; font-size: 22px; line-height: 1; flex-shrink: 0; }
}

.scenario-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  strong { font-size: 12px; font-weight: 600; }
  small { font-size: 10.5px; color: var(--text-dim); line-height: 1.3; }
}
</style>
