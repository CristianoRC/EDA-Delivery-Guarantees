# Delivery Guarantees Simulator (Event Driven Architecture)

> ⚠️ **Work in Progress**
>
> This project is under active development. Scenarios, brokers and visual
> behavior may change without notice. New patterns (Outbox, Saga, Retry with
> Backoff) are planned and existing flows are still being refined. Use it for
> learning and exploration; expect rough edges and breaking changes.

An interactive, browser based simulator built for **teaching delivery guarantees in EDA**. Visualizes the full `Producer → Broker → Consumer → DB` flow with animated messages, injectable failures, and contextual metrics, so the bug caused by missing idempotency (or a poison message reaching the DLQ) becomes obvious in real time.

Built with Vue 3 + Vuetify + Pinia + Vite. Run `npm install && npm run dev` to start locally, or open the deployed site.

## Scenarios

The simulator is organized as a **side menu of scenarios**, each isolating one concept. Pick a scenario on the left, the rest of the UI adapts.

| Scenario | What it teaches | Default tool |
|----------|-----------------|--------------|
| 💨 **At most once** | Fire and forget. Messages can be lost on any failure. | Azure Storage Queue |
| 🔁 **At least once** | Retry until ACK. Messages can be duplicated. *Idempotency toggle here.* | Azure Service Bus |
| 🛡️ **Exactly once** | Broker side dedup + transactional commits. | Azure Service Bus |
| 🪦 **Dead Letter Queue** | Poison messages exceed MaxDeliveryCount → moved to DLQ. | Azure Service Bus |

## The teaching scenario

For the three delivery guarantees, the demo is a **bank transfer of $100** to "John". Each message you send adds $100 to John's balance. The metrics card shows **Expected vs Actual** in the DB. When they diverge, you see the bug.

For **DLQ**, messages are tagged as *poison* with a configurable probability. Poison messages always fail processing. They bounce back to the broker for redelivery, and once the delivery count exceeds the configured threshold, they are moved to the dead letter queue instead of being retried forever. The metrics flip to show **Successfully processed vs Dead lettered**.

## Tools modeled

Each tool exposes only the guarantees / DLQ behavior it actually supports natively. Unsupported options appear disabled in the dropdown.

### Azure
* **Azure Service Bus**: `PeekLock` + `Complete()` (at least once); `RequiresDuplicateDetection` (exactly once); **native DLQ** after `MaxDeliveryCount`.
* **Service Bus + Sessions**: FIFO per `SessionId` + dedup; native DLQ.
* **Azure Event Hubs**: Kafka like with partitions; **no native DLQ** (implement via separate handler).
* **Azure Event Grid**: at least once HTTP pub/sub with exponential retry; **dead letter to Blob Storage**.
* **Azure Storage Queue**: simple queue with `VisibilityTimeout`; **no native DLQ** (implement via `DequeueCount` check).

### Others
* **RabbitMQ**: `publisher confirms` + `manual ack`; **native DLX** (Dead Letter Exchange) on nack/reject/TTL.
* **Apache Kafka**: full EOS via idempotent producer + transactions; **no native DLQ** (common pattern: dedicated dead letter topic).

## Injectable failures

Four checkboxes inject realistic distributed system failures (used by all scenarios):

* **📤 Producer 10%**: broker is down / producer can't publish.
* **📡 Network 15%**: packet lost in transit (Producer → Broker).
* **✉️ ACK 20%**: consumer's ACK never reaches the broker (triggers redelivery).
* **💥 Crash 15%**: consumer crashes *after* processing but *before* ACKing.

Or hit **Chaos burst** to enable everything and send 15 messages in a row.

## File layout

```
Delivery-Guarantees/
├── index.html              # entry point + SEO meta + noscript fallback
├── public/                 # robots.txt, sitemap.xml, manifest, OG image, CNAME
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── components/         # AppTopBar, AppSideBar, SimulationStage, EventLog, etc.
│   ├── stores/             # Pinia stores (simulator, log)
│   ├── composables/        # reusable logic
│   ├── config/             # scenario + tool definitions
│   ├── plugins/            # Vuetify setup
│   └── styles/             # SCSS theme
├── vite.config.js
├── package.json
└── README.md
```

Runs entirely client side. No backend, no analytics, no external API calls.

## Architecture notes

* **Scenarios** live in a `SCENARIOS` map; each has `mode`, `showIdempotency`, `showDLQ`, `defaultTool`. Switching scenarios resets state, swaps the metrics card, and refreshes the settings panel.
* **Stage grid** uses CSS grid. In DLQ mode, an extra row is enabled and the DLQ node is positioned beneath the broker.
* **Animated messages** are absolutely positioned DOM pills moved with CSS transitions. No canvas, no SVG.
* **Consumer side idempotency** is modeled as a `Set<idempotencyKey>` (Redis / inbox table).
* **Broker side dedup** (exactly once) is a separate `Set` (Service Bus duplicate detection / Kafka idempotent producer).
* **DLQ logic** tracks `deliveryCount` per message; when it hits `maxDeliveryCount`, the broker animates the message to the DLQ node instead of redelivering.
