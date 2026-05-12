<template>
  <div class="bottom-bar">
    <send-card />
    <failures-card />
    <metrics-card />
  </div>
</template>

<script setup>
import SendCard from './SendCard.vue'
import FailuresCard from './FailuresCard.vue'
import MetricsCard from './MetricsCard.vue'
</script>

<style lang="scss" scoped>
.bottom-bar {
  display: grid;
  grid-template-columns: 180px 260px 1fr;
  gap: 12px;
  flex-shrink: 0;
}
</style>
