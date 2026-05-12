<template>
  <section class="card card-actions">
    <header class="card-header">
      <span class="card-title">Send</span>
      <span class="card-sub">$100 per msg</span>
    </header>
    <div class="actions">
      <button class="btn btn-primary" @click="delivery.sendLogicalMessage(100)">+1</button>
      <button class="btn" @click="delivery.sendBatch(5)">+5</button>
      <button class="btn btn-danger" @click="delivery.chaosBurst()">Chaos burst</button>
    </div>
  </section>
</template>

<script setup>
import { useDelivery } from '@/composables/useDelivery'
const delivery = useDelivery()
</script>

<style lang="scss" scoped>
@use '@/components/_card' as *;
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;

  .btn { padding: 8px 6px; font-size: 12px; }
  .btn-danger { grid-column: span 2; }
}
</style>
