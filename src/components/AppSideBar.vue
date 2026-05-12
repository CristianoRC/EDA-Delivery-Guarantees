<template>
  <aside class="sidebar">
    <div class="sidebar-section">
      <scenario-category title="Delivery Guarantees" dot-class="cat-dot-guarantees">
        <scenario-item
          v-for="id in CATEGORIES[0].scenarios"
          :key="id"
          :icon="SCENARIOS[id].icon"
          :title="SCENARIOS[id].name"
          :blurb="SCENARIOS[id].blurb"
          :active="store.scenario === id"
          @select="store.setScenario(id)"
        />
      </scenario-category>

      <scenario-category title="Reliability Patterns" dot-class="cat-dot-patterns">
        <scenario-item
          v-for="id in CATEGORIES[1].scenarios"
          :key="id"
          :icon="SCENARIOS[id].icon"
          :title="SCENARIOS[id].name"
          :blurb="SCENARIOS[id].blurb"
          :active="store.scenario === id"
          @select="store.setScenario(id)"
        />
      </scenario-category>

      <scenario-category title="Coming Soon" dot-class="cat-dot-soon">
        <scenario-item
          v-for="s in CATEGORIES[2].scenarios"
          :key="s.name"
          :icon="s.icon"
          :title="s.name"
          :blurb="s.blurb"
          disabled
        />
      </scenario-category>
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-title">Settings</h3>
      <settings-panel />
    </div>
  </aside>
</template>

<script setup>
import ScenarioCategory from './ScenarioCategory.vue'
import ScenarioItem from './ScenarioItem.vue'
import SettingsPanel from './SettingsPanel.vue'
import { SCENARIOS, CATEGORIES } from '@/config/scenarios'
import { useSimulatorStore } from '@/stores/simulator'

const store = useSimulatorStore()
</script>

<style lang="scss" scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  min-height: 0;
}

.sidebar-section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.sidebar-title {
  margin: 0 0 10px 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-dimmer);
  font-weight: 700;
}
</style>
