<template>
  <section class="card card-actions">
    <header class="card-header">
      <span class="card-title">Send</span>
      <span class="card-sub">{{ subTitle }}</span>
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
      <button
        v-else-if="store.isOutbox"
        class="btn btn-outbox"
        title="Send 10 messages with both outbox failures enabled"
        @click="outboxStress"
      >
        📦 Stress relay
      </button>
      <button v-else class="btn btn-danger" @click="delivery.chaosBurst()">Chaos burst</button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useDelivery } from '@/composables/useDelivery'
import { useSimulatorStore } from '@/stores/simulator'
import { useLogStore } from '@/stores/log'

const delivery = useDelivery()
const store = useSimulatorStore()
const log = useLogStore()

const subTitle = computed(() => {
  if (store.isDLQ) return 'message to broker'
  if (store.isOutbox) return 'tx + outbox row'
  return '$100 per msg'
})

function outboxStress() {
  store.fails.dbCommit = true
  store.fails.relayCrash = true
  log.push('🌪️ Stress relay: 10 messages with DB-commit and relay-crash failures enabled', 'warn')
  delivery.sendBatch(10)
}
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
  .btn-outbox {
    grid-column: span 2;
    background: var(--outbox, #a78bfa);
    color: #0b1220;
    border-color: transparent;
    font-weight: 700;
    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 0 12px rgba(167, 139, 250, 0.4);
    }
  }
}
</style>
