import { useSimulatorStore } from '@/stores/simulator'

// Refs to the DOM containers populated by SimulationStage on mount.
const nodes = {
  producer: null,
  broker: null,
  consumer: null,
  db: null,
  dlq: null,
  outbox: null,
}
let stageEl = null
let layerEl = null

export function registerNode(name, el) { nodes[name] = el }
export function registerStage(el) { stageEl = el }
export function registerLayer(el) { layerEl = el }

function centerOf(name) {
  const node = nodes[name]
  if (!node || !stageEl) return { x: 0, y: 0 }
  const r = node.getBoundingClientRect()
  const sr = stageEl.getBoundingClientRect()
  return {
    x: r.left - sr.left + r.width / 2,
    y: r.top - sr.top + r.height / 2,
  }
}

export function animateMsg(fromName, toName, label, cls = '', willLose = false) {
  const store = useSimulatorStore()
  return new Promise((resolve) => {
    if (!layerEl) return resolve()
    const msg = document.createElement('div')
    msg.className = `msg ${cls}`.trim()
    msg.textContent = label
    const from = centerOf(fromName)
    const to = centerOf(toName)
    msg.style.left = from.x + 'px'
    msg.style.top = from.y + 'px'
    msg.style.transition = `all ${store.speed}ms cubic-bezier(0.4, 0, 0.2, 1)`
    layerEl.appendChild(msg)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (willLose) {
          msg.style.left = (from.x + to.x) / 2 + 'px'
          msg.style.top = (from.y + to.y) / 2 + 'px'
          msg.style.opacity = '0'
          msg.style.transform = 'translate(-50%, -50%) scale(0.4) rotate(-25deg)'
          msg.classList.add('lost')
        } else {
          msg.style.left = to.x + 'px'
          msg.style.top = to.y + 'px'
        }
      })
    })

    setTimeout(() => { msg.remove(); resolve() }, store.speed)
  })
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
