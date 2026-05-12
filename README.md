# Delivery Guarantees Simulator — Event-Driven Architecture

An interactive, browser-based simulator built for **teaching delivery guarantees in EDA**. Visualizes the full `Producer → Broker → Consumer → DB` flow with animated messages, injectable failures, and contextual metrics — so the bug caused by missing idempotency (or a poison message reaching the DLQ) becomes obvious in real time.

No build step, no dependencies. Open `index.html` and go.

---

## Scenarios

The simulator is organized as a **side menu of scenarios**, each isolating one concept. Pick a scenario on the left, the rest of the UI adapts.

| Scenario | What it teaches | Default tool |
|----------|-----------------|--------------|
| 💨 **At-most-once** | Fire-and-forget. Messages can be lost on any failure. | Azure Storage Queue |
| 🔁 **At-least-once** | Retry until ACK. Messages can be duplicated. *Idempotency toggle here.* | Azure Service Bus |
| 🛡️ **Exactly-once** | Broker-side dedup + transactional commits. | Azure Service Bus |
| 🪦 **Dead Letter Queue** | Poison messages exceed MaxDeliveryCount → moved to DLQ. | Azure Service Bus |

---

## The teaching scenario

For the three delivery guarantees, the demo is a **bank transfer of $100** to "John". Each message you send adds $100 to John's balance. The metrics card shows **Expected vs Actual** in the DB — when they diverge, you see the bug.

For **DLQ**, messages are tagged as *poison* with a configurable probability. Poison messages always fail processing — they bounce back to the broker for redelivery, and once the delivery count exceeds the configured threshold, they are moved to the dead-letter queue instead of being retried forever. The metrics flip to show **Successfully processed vs Dead-lettered**.

---

## Tools modeled

Each tool exposes only the guarantees / DLQ behavior it actually supports natively. Unsupported options appear disabled in the dropdown.

### Azure
- **Azure Service Bus** — `PeekLock` + `Complete()` (at-least-once); `RequiresDuplicateDetection` (exactly-once); **native DLQ** after `MaxDeliveryCount`
- **Service Bus + Sessions** — FIFO per `SessionId` + dedup; native DLQ
- **Azure Event Hubs** — Kafka-like with partitions; **no native DLQ** (implement via separate handler)
- **Azure Event Grid** — at-least-once HTTP pub/sub with exponential retry; **dead-letter to Blob Storage**
- **Azure Storage Queue** — simple queue with `VisibilityTimeout`; **no native DLQ** (implement via `DequeueCount` check)

### Others
- **RabbitMQ** — `publisher confirms` + `manual ack`; **native DLX** (Dead Letter Exchange) on nack/reject/TTL
- **Apache Kafka** — full EOS via idempotent producer + transactions; **no native DLQ** (common pattern: dedicated dead-letter topic)

---

## Injectable failures

Four checkboxes inject realistic distributed-system failures (used by all scenarios):

- **📤 Producer 10%** — broker is down / producer can't publish
- **📡 Network 15%** — packet lost in transit (Producer → Broker)
- **✉️ ACK 20%** — consumer's ACK never reaches the broker (triggers redelivery)
- **💥 Crash 15%** — consumer crashes *after* processing but *before* ACKing

Or hit **Chaos burst** to enable everything and send 15 messages in a row.

---

## Classroom walkthroughs

### 5-minute demo: the idempotency bug

1. Pick **At-least-once** scenario. Tool: **Azure Service Bus**. Speed: **Slow**.
2. **Idempotency: OFF**. Enable **ACK 20%** failure. Click **+5**.
3. Watch messages travel `Producer → Broker → Consumer → DB`. When an ACK is lost, the broker redelivers — balance climbs past expected.
4. Metrics light up: **Δ +$200 • inflated** in yellow. This is the bug.
5. **Reset → Idempotency: ON**. Repeat. Consumer logs `🛡️ already processed — discarded`. Balance ends at expected. Δ shows **OK** in green.

### 3-minute demo: dead-letter queue

1. Pick **Dead Letter Queue** scenario. Tool: **Azure Service Bus**.
2. Notice the **🪦 DLQ node appears** below the broker. Settings show *Max delivery count* (default 3) and *Poison message rate* (default 30%).
3. Click **+5**. Some messages succeed; the poison ones (with ☠️) bounce attempt 1 → 2 → 3 → DLQ.
4. Metrics: **Successfully processed** vs **Dead-lettered** percentage.
5. Try switching tool to **Apache Kafka** — disabled, because Kafka has no native DLQ.

---

## File layout

```
Delivery-Guarantees/
├── index.html       # markup + inline SVG favicon
├── styles.css       # dark theme, scenario sidebar, DLQ grid mode
├── simulator.js     # scenarios, state machine, delivery logic
├── .gitignore
└── README.md
```

Everything runs client-side. No build step, no `npm install`, no server. Open `index.html` in any modern browser.

---

## Architecture notes

- **Scenarios** live in a `SCENARIOS` map; each has `mode`, `showIdempotency`, `showDLQ`, `defaultTool`. Switching scenarios resets state, swaps the metrics card, and re-renders the settings panel.
- **Stage grid** uses CSS grid. In DLQ mode, an extra row is enabled and the DLQ node is positioned beneath the broker.
- **Animated messages** are absolutely-positioned DOM pills moved with CSS transitions — no canvas/SVG.
- **Consumer-side idempotency** is modeled as a `Set<idempotencyKey>` (Redis / inbox table).
- **Broker-side dedup** (exactly-once) is a separate `Set` (Service Bus duplicate detection / Kafka idempotent producer).
- **DLQ logic** tracks `deliveryCount` per message; when it hits `maxDeliveryCount`, the broker animates the message to the DLQ node instead of redelivering.

---

## Adding new scenarios

To add a scenario (e.g., **Outbox Pattern**, **Saga Compensation**, **Retry with Backoff**):

1. Add an entry to `SCENARIOS` in `simulator.js` with `name`, `icon`, `mode`, and any feature flags.
2. Add a `<button class="scenario-item" data-scenario="...">` to the sidebar in `index.html`.
3. If it needs a new node, declare it in the grid (mirror the DLQ pattern) and toggle visibility via a CSS class in `applyScenario()`.
4. If it has custom settings, extend `renderSettings()` to inject the right controls.
5. Implement the delivery flow (e.g., `sendOutboxMessage()`) and route to it from `sendLogicalMessage()`.

---

## License

Free for educational use.
