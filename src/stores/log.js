import { defineStore } from 'pinia'
import { ref } from 'vue'

const MAX_ENTRIES = 500

export const useLogStore = defineStore('log', () => {
  const entries = ref([])
  const startTime = ref(Date.now())
  let counter = 0

  function push(msg, level = 'info') {
    const time = ((Date.now() - startTime.value) / 1000).toFixed(2)
    entries.value.push({
      id: ++counter,
      time: time.padStart(6, ' '),
      msg,
      level,
    })
    if (entries.value.length > MAX_ENTRIES) {
      entries.value.splice(0, entries.value.length - MAX_ENTRIES)
    }
  }

  function reset() {
    entries.value = []
    startTime.value = Date.now()
    counter = 0
  }

  return { entries, push, reset }
})
