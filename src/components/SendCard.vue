<template>
  <section class="card card-actions">
    <header class="card-header">
      <span class="card-title">Send</span>
      <span class="card-sub">{{ store.isDLQ ? 'message to broker' : '$100 per msg' }}</span>
    </header>
    <div class="actions" :class="{ 'dlq-actions': store.isDLQ }">
      <button class="btn btn-primary" @click="delivery.sendLogicalMessage(100)">+1</button>
      <button class="btn" @click="delivery.sendBatch(5)">+5</button>
      <button
        v-if="store.isDLQ"
        class="btn btn-poison"
        title="Sends a message with invalid payload — guaranteed to fail and end up in the DLQ"
        @click="delivery.sendPoisonMessage()"
      >
        ☠️ Send poison
      </button>
      <button v-else class="btn btn-danger" @click="delivery.chaosBurst()">Chaos burst</button>
    </div>
  </section>
</template>

<script setup>
import { useDelivery } from '@/composables/useDelivery'
import { useSimulatorStore } from '@/stores/simulator'

const delivery = useDelivery()
const store = useSimulatorStore()
</script>

<style lang="scss" scoped>
@use '@/components/_card' as *;
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;

  .btn { padding: 8px 6px; font-size: 12px; }
  .btn-danger { grid-column: span 2; }
  .btn-poison {
    grid-column: span 2;
    background: var(--dlq, #ef4444);
    color: white;
    border-color: transparent;
    font-weight: 700;
    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
    }
  }
}
</style>
