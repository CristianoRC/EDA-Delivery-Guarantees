export const SCENARIOS = {
  'at-most-once': {
    id: 'at-most-once',
    name: 'At-most-once',
    icon: '💨',
    blurb: 'Fire and forget. May lose.',
    mode: 'at-most-once',
    showIdempotency: false,
    showDLQ: false,
    defaultTool: 'storagequeue',
    category: 'guarantees',
  },
  'at-least-once': {
    id: 'at-least-once',
    name: 'At-least-once',
    icon: '🔁',
    blurb: 'Retry until ACK. May duplicate.',
    mode: 'at-least-once',
    showIdempotency: true,
    showDLQ: false,
    defaultTool: 'servicebus',
    category: 'guarantees',
  },
  'exactly-once': {
    id: 'exactly-once',
    name: 'Exactly-once',
    icon: '🛡️',
    blurb: 'Broker dedup + transactions.',
    mode: 'exactly-once',
    showIdempotency: true,
    showDLQ: false,
    defaultTool: 'servicebus',
    category: 'guarantees',
  },
  dlq: {
    id: 'dlq',
    name: 'Dead Letter Queue',
    icon: '🪦',
    blurb: 'Poison messages → DLQ after N retries.',
    mode: 'at-least-once',
    showIdempotency: false,
    showDLQ: true,
    defaultTool: 'servicebus',
    category: 'patterns',
  },
}

export const CATEGORIES = [
  {
    id: 'guarantees',
    title: 'Delivery Guarantees',
    dotClass: 'cat-dot-guarantees',
    scenarios: ['at-most-once', 'at-least-once', 'exactly-once'],
  },
  {
    id: 'patterns',
    title: 'Reliability Patterns',
    dotClass: 'cat-dot-patterns',
    scenarios: ['dlq'],
  },
  {
    id: 'soon',
    title: 'Coming Soon',
    dotClass: 'cat-dot-soon',
    disabled: true,
    scenarios: [
      { icon: '📤', name: 'Outbox Pattern', blurb: 'Atomic publish + DB write' },
      { icon: '📥', name: 'Inbox Pattern', blurb: 'Consumer-side dedup store' },
    ],
  },
]

export const SPEEDS = [
  { label: 'Slow', value: 2200 },
  { label: 'Normal', value: 1400 },
  { label: 'Fast', value: 700 },
]
