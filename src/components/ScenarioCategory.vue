<template>
  <div class="scenario-category">
    <h3 class="sidebar-title">
      <span class="cat-dot" :class="dotClass" />
      {{ title }}
    </h3>
    <div class="scenario-list">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  dotClass: { type: String, default: '' },
})
</script>

<style lang="scss" scoped>
.scenario-category {
  display: flex;
  flex-direction: column;

  & + & {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed var(--border);
  }
}

.sidebar-title {
  margin: 0 0 10px 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-dimmer);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;

  &.cat-dot-guarantees { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
  &.cat-dot-patterns { background: var(--dlq); box-shadow: 0 0 6px var(--dlq); }
  &.cat-dot-soon { background: var(--text-dimmer); }
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
