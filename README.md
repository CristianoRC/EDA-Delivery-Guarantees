<img src="public/icon.svg" alt="EDA Simulator logo" width="64" />

# EDA Simulator

> ⚠️ **Work in Progress**
>
> This project is under active development. Scenarios, brokers and visual
> behavior may change without notice. New patterns (Saga, Retry with Backoff)
> are planned and existing flows are still being refined. Use it for learning
> and exploration; expect rough edges and breaking changes.

Browser-based simulator for **Event-Driven Architecture**. Visualizes the full `Producer → Broker → Consumer → DB` flow with animated messages, injectable failures and contextual metrics, so the bug caused by missing idempotency (or a poison message reaching the DLQ) becomes obvious in real time.

Built with Vue 3 + Vuetify + Pinia + Vite. Run `npm install && npm run dev` to start locally, or open the deployed site.

## Scenarios

The simulator is organized as a **side menu of scenarios**, each isolating one concept. Pick a scenario on the left, the rest of the UI adapts.

### Delivery Guarantees

| Scenario | What it teaches | Default tool |
| --- | --- | --- |
| 💨 **At most once** | Fire and forget. Messages can be lost on any failure. | Azure Storage Queue |
| 🔁 **At least once** | Retry until ACK. Messages can be duplicated. *Idempotency toggle here.* | Azure Service Bus |
| 🛡️ **Exactly once** | Broker side dedup + transactional commits. | Azure Service Bus |

### Reliability Patterns

| Scenario | What it teaches | Default tool |
| --- | --- | --- |
| 🪦 **Dead Letter Queue** | Poison messages exceed MaxDeliveryCount, moved to DLQ. | Azure Service Bus |
| 📦 **Outbox Pattern** | Atomic DB write + relay polling to broker (no dual-write). | Azure Service Bus |
| 📥 **Inbox Pattern** | Consumer-side dedup via atomic inbox table inside the consumer transaction. | Azure Service Bus |

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
* **Redis Pub/Sub**: fire and forget on channels; no persistence, no ACK, no DLQ. **At most once only** (for at least once, use Redis Streams + consumer groups instead).

## Injectable failures

The failures panel adapts to the active scenario, exposing only the failure modes that are meaningful for the pattern being taught.

### Delivery Guarantees (at-most-once, at-least-once, exactly-once)

* **📤 Producer 10%**: broker is down or producer can't publish.
* **📡 Network 15%**: packet lost in transit (Producer → Broker).
* **✉️ ACK 20%**: consumer's ACK never reaches the broker (triggers redelivery).
* **💥 Crash 15%**: consumer crashes *after* processing but *before* ACKing.
* **🛑 Consumer down**: consumer is offline; messages pile up in the broker.
* **🥵 Overload 25%**: consumer is overloaded and rejects work under pressure.

Or hit **Chaos burst** to enable everything and send 15 messages in a row.

### Dead Letter Queue

* **☠️ Poison 100%**: every message is a poison pill and always fails processing, so you can observe the redelivery loop and DLQ landing.

### Outbox Pattern

* **🧨 DB commit 25%**: the atomic business + outbox transaction aborts (nothing is written, nothing is published).
* **🪓 Relay crash 40%**: the relay/poller crashes between reading the outbox and publishing to the broker.

### Inbox Pattern

* **↩️ Tx abort 25%**: the consumer transaction (inbox insert + business write) aborts before commit.
* **✉️ ACK lost 40%**: the ACK to the broker is lost after the inbox commit, forcing redelivery (dedup is exercised).

Runs entirely client side. No backend, no analytics, no external API calls.

## Architecture notes

* **Scenarios** live in a `SCENARIOS` map; each has `mode`, `showIdempotency`, `showDLQ`, `defaultTool`. Switching scenarios resets state, swaps the metrics card, and refreshes the settings panel.
* **Stage grid** uses CSS grid. In DLQ mode, an extra row is enabled and the DLQ node is positioned beneath the broker.
* **Animated messages** are absolutely positioned DOM pills moved with CSS transitions. No canvas, no SVG.
* **Consumer side idempotency** is modeled as a `Set<idempotencyKey>` (Redis / inbox table).
* **Broker side dedup** (exactly once) is a separate `Set` (Service Bus duplicate detection / Kafka idempotent producer).
* **DLQ logic** tracks `deliveryCount` per message; when it hits `maxDeliveryCount`, the broker animates the message to the DLQ node instead of redelivering.

## Contributing

Found a bug, have an idea for a new scenario, or spotted something confusing? Jump in! 🎉

1. Fork the repo and create a branch.
2. Make your change (a new scenario, a fix, even a typo counts).
3. Open a PR and tell us what you tried.

Not sure where to start? Open an issue and let's chat about it first. All skill levels welcome.
