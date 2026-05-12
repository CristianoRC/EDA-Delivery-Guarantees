<template>
  <section class="card card-metrics">
    <div class="hero">
      <div class="hero-side">
        <span class="hero-tag">{{ leftTag }}</span>
        <span class="hero-num">{{ leftValue }}</span>
      </div>
      <div class="hero-divider">
        <span class="hero-arrow">{{ arrow }}</span>
        <span class="hero-delta" :class="deltaClass">{{ deltaText }}</span>
      </div>
      <div class="hero-side hero-actual">
        <span class="hero-tag">{{ rightTag }}</span>
        <span class="hero-num" :class="rightClass">{{ rightValue }}</span>
      </div>
    </div>
    <div class="mini-stats">
      <div class="mini-stat"><span class="dot dot-blue" /><b>{{ s.logicalSent }}</b> sent</div>
      <div class="mini-stat"><span class="dot dot-green" /><b>{{ s.delivered }}</b> delivered</div>
      <div class="mini-stat">
        <span class="dot dot-yellow" /><b>{{ s.duplicated }}</b>
        {{ isDLQ ? 'redelivered' : 'duplicated' }}
      </div>
      <div v-if="isDLQ" class="mini-stat"><span class="dot dot-dlq" /><b>{{ s.deadLettered }}</b> in DLQ</div>
      <div v-else-if="isInbox" class="mini-stat"><span class="dot dot-inbox" /><b>{{ s.inboxDedups }}</b> deduped</div>
      <div v-else class="mini-stat"><span class="dot dot-red" /><b>{{ s.lost }}</b> lost</div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useSimulatorStore } from '@/stores/simulator'

const store = useSimulatorStore()
const s = computed(() => store.stats)
const isDLQ = computed(() => store.isDLQ)
const isInbox = computed(() => store.isInbox)

const leftTag = computed(() => isDLQ.value ? 'Successfully processed' : 'Expected')
const leftValue = computed(() => isDLQ.value ? s.value.delivered : `$ ${s.value.expected}`)
const rightTag = computed(() => isDLQ.value ? 'Dead-lettered' : 'Actual in DB')
const rightValue = computed(() => isDLQ.value ? s.value.deadLettered : `$ ${s.value.balance}`)

const rightClass = computed(() => {
  if (isDLQ.value) return ''
  const diff = store.balanceDiff
  if (diff > 0) return 'warn'
  if (diff < 0) return 'danger'
  return ''
})

const arrow = computed(() => {
  if (isDLQ.value) return 'vs'
  if (s.value.expected === 0) return 'vs'
  const diff = store.balanceDiff
  if (diff === 0) return '='
  return diff > 0 ? '↑' : '↓'
})

const { text: deltaText, cls: deltaClass } = (() => {
  return {
    text: computed(() => {
      if (isDLQ.value) {
        if (s.value.logicalSent === 0) return '— sent'
        const rate = ((s.value.deadLettered / s.value.logicalSent) * 100).toFixed(0)
        return `${rate}% poisoned`
      }
      if (s.value.expected === 0) return 'Δ —'
      const diff = store.balanceDiff
      if (diff === 0) return 'Δ $ 0 • OK'
      if (diff > 0) return `Δ +$ ${diff} • inflated`
      return `Δ $ ${diff} • lost`
    }),
    cls: computed(() => {
      if (isDLQ.value) {
        if (s.value.logicalSent === 0) return ''
        if (s.value.deadLettered === 0) return 'ok'
        const rate = (s.value.deadLettered / s.value.logicalSent) * 100
        return rate < 50 ? 'warn' : 'danger'
      }
      if (s.value.expected === 0) return ''
      const diff = store.balanceDiff
      if (diff === 0) return 'ok'
      if (diff > 0) return 'warn'
      return 'danger'
    }),
  }
})()
</script>

<style lang="scss" scoped>
@use '@/components/_card' as *;

.card-metrics {
  padding: 0;
  overflow: hidden;
}

.hero {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  padding: 14px 18px 12px 18px;
  background: linear-gradient(135deg, rgba(74,222,128,0.08), rgba(56,189,248,0.04));
  border-bottom: 1px solid var(--border-soft);
}

.hero-side { display: flex; flex-direction: column; gap: 2px; }
.hero-side.hero-actual { align-items: flex-end; text-align: right; }
.hero-tag {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-dimmer);
  font-weight: 700;
}
.hero-num {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  line-height: 1.1;

  &.warn { color: var(--warn); }
  &.danger { color: var(--danger); }
}
.hero-side.hero-actual .hero-num { color: var(--ok); }
.hero-side.hero-actual .hero-num.warn { color: var(--warn); }
.hero-side.hero-actual .hero-num.danger { color: var(--danger); }

.hero-divider { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.hero-arrow {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-dimmer);
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
}
.hero-delta {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dimmer);
  font-variant-numeric: tabular-nums;
  &.ok { color: var(--ok); }
  &.warn { color: var(--warn); }
  &.danger { color: var(--danger); }
}

.mini-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 10px 16px;
  gap: 8px;
  background: rgba(15, 23, 42, 0.4);
}
.mini-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  b {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
}
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-blue { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.dot-green { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
.dot-yellow { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
.dot-red { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
.dot-dlq { background: var(--dlq); box-shadow: 0 0 8px var(--dlq); }
.dot-inbox { background: var(--inbox); box-shadow: 0 0 8px var(--inbox); }
</style>
