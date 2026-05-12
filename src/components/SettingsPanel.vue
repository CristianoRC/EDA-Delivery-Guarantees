<template>
  <div class="settings-content">
    <div v-if="sc.showIdempotency" class="setting-row">
      <span class="setting-label">Consumer idempotency</span>
      <div class="switch-inline">
        <label class="switch">
          <input
            type="checkbox"
            :checked="store.idempotency"
            @change="store.setIdempotency($event.target.checked)"
          />
          <span class="slider"></span>
        </label>
        <span class="switch-state" :style="{ color: store.idempotency ? 'var(--ok)' : 'var(--text-dim)' }">
          {{ store.idempotency ? 'ON' : 'OFF' }}
        </span>
      </div>
      <span class="setting-hint">
        Discards repeated messages by <code style="font-size:9px">idempotency_key</code> (Redis / inbox table).
      </span>
    </div>

    <template v-if="sc.showDLQ">
      <div class="setting-row">
        <span class="setting-label">
          Max delivery count
          <span class="setting-value">{{ store.maxDeliveryCount }}</span>
        </span>
        <input
          type="range"
          min="1"
          max="10"
          :value="store.maxDeliveryCount"
          @input="store.maxDeliveryCount = Number($event.target.value)"
        />
        <span class="setting-hint">
          After this many failed delivery attempts, the broker moves the message to the DLQ.
        </span>
      </div>
      <div class="setting-row">
        <span class="setting-label">
          Poison message rate
          <span class="setting-value">{{ store.poisonRate }}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          :value="store.poisonRate"
          @input="store.poisonRate = Number($event.target.value)"
        />
        <span class="setting-hint">
          Percentage of messages that always fail processing — they will be dead-lettered.
        </span>
      </div>
    </template>

    <template v-if="sc.showOutbox">
      <div class="setting-row">
        <span class="setting-label">Relay strategy</span>
        <div class="seg-control">
          <button
            class="seg-btn"
            :class="{ active: store.outboxMode === 'polling' }"
            @click="store.setOutboxMode('polling')"
          >
            🛰️ Polling
          </button>
          <button
            class="seg-btn"
            :class="{ active: store.outboxMode === 'cdc' }"
            @click="store.setOutboxMode('cdc')"
          >
            ⚡ CDC
          </button>
        </div>
        <span class="setting-hint">
          <strong v-if="store.outboxMode === 'polling'">Polling:</strong>
          <template v-if="store.outboxMode === 'polling'">
            background worker runs <code>SELECT … WHERE published_at IS NULL</code> every ~1.5s and publishes the batch. Simple, but adds DB load and latency.
          </template>
          <strong v-else>CDC (Change Data Capture):</strong>
          <template v-if="store.outboxMode === 'cdc'">
            a connector tails the database's transaction log and emits a change event for every row inserted into the outbox — no polling, near-realtime, no extra DB load.
          </template>
        </span>
      </div>
    </template>

    <span v-if="!sc.showIdempotency && !sc.showDLQ && !sc.showOutbox" class="setting-hint" style="font-size:11px;">
      No extra settings for this scenario. Just inject failures and watch what happens.
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'

const store = useSimulatorStore()
const sc = computed(() => store.scenarioConfig)
</script>

<style lang="scss" scoped>
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-row { display: flex; flex-direction: column; gap: 4px; }
.setting-label {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 600;
  display: flex;
  justify-content: space-between;

  .setting-value {
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
}

.setting-row input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
}

.switch-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.setting-hint {
  font-size: 10px;
  color: var(--text-dimmer);
  line-height: 1.4;
  margin-top: 2px;
}

.switch { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.switch input { display: none; }
.switch .slider {
  position: relative;
  width: 38px; height: 20px;
  background: var(--border);
  border-radius: 22px;
  transition: 0.2s;
}
.switch .slider::before {
  content: "";
  position: absolute;
  width: 14px; height: 14px;
  background: white;
  border-radius: 50%;
  top: 3px; left: 3px;
  transition: 0.2s;
}
.switch input:checked + .slider { background: var(--ok); }
.switch input:checked + .slider::before { transform: translateX(18px); }
.switch-state {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
}

.seg-control {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  background: var(--bg-panel-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-top: 2px;
}
.seg-btn {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 600;
  padding: 6px 4px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { color: var(--text); }
  &.active {
    background: var(--outbox);
    color: #0b1220;
    box-shadow: 0 0 8px rgba(167, 139, 250, 0.4);
  }
}
</style>
