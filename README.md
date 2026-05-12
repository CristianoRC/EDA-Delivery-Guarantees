# Delivery Guarantees Simulator — Event-Driven Architecture

An interactive, browser-based simulator built for **teaching delivery guarantees in EDA**. It visualizes the full `Producer → Broker → Consumer → DB` flow with animated messages, injectable failures, and a side-by-side comparison of *expected vs actual* state — so the bug caused by missing idempotency becomes obvious in real time.

No build step, no dependencies. Open `index.html` and go.

---

## What it shows

The scenario is a **bank transfer of $100** to "John". Each message you send adds $100 to John's balance. The simulator tracks **expected balance** (what the user wanted) vs the **actual balance** stored in the DB after the broker/consumer dance. When the two diverge, you can see exactly *why*.

### The three delivery guarantees

| Mode | What happens | Risk |
|------|--------------|------|
| **At-most-once** | Producer sends and forgets. Consumer doesn't ACK. | Messages can be **lost** |
| **At-least-once** | Producer retries until ACK. Consumer commits after processing. | Messages can be **duplicated** |
| **Exactly-once** | Broker deduplicates by `MessageId` + transactional commits. | Slower, more expensive infra |

### Idempotency toggle

The key teaching moment: with **at-least-once + idempotency OFF**, retries inflate John's balance to $200, $300… Turn the switch ON and the consumer's dedup store discards repeats — balance stays correct.

---

## Tools modeled

Each tool only exposes the guarantees it **actually supports natively**. Unsupported modes are shown crossed-out with a tooltip explaining why.

### Azure
- **Azure Service Bus** — `PeekLock` + `Complete()` for at-least-once; `RequiresDuplicateDetection` for exactly-once (up to 7-day window)
- **Service Bus + Sessions** — FIFO per `SessionId` + dedup, the strongest option
- **Azure Event Hubs** — Kafka-like with partitions and offsets; checkpoint-based
- **Azure Event Grid** — at-least-once only; HTTP pub/sub with exponential retry + dead-letter to Blob
- **Azure Storage Queue** — simple queue with `VisibilityTimeout`

### Others
- **RabbitMQ** — `publisher confirms` + `manual ack`; exactly-once is NOT native
- **Apache Kafka** — at-least-once default; full EOS via idempotent producer + transactions

---

## Injectable failures

Four checkboxes let you inject realistic distributed-system failures:

- **📤 Producer 10%** — broker is down / producer can't publish
- **📡 Network 15%** — packet lost in transit (Producer → Broker)
- **✉️ ACK 20%** — consumer's ACK never reaches the broker (triggers redelivery)
- **💥 Crash 15%** — consumer crashes *after* processing but *before* ACKing

Or hit **Chaos burst** to enable everything and send 15 messages in a row.

---

## Classroom walkthrough

A 5-minute demo flow:

1. **Pick a tool** that doesn't support exactly-once natively (e.g., **Event Grid**). Notice the *Exactly-once* tab is grayed out.
2. **Speed: Slow** so students can follow each animation.
3. **Idempotency: OFF**. Enable the **ACK 20%** failure. Click **+5**.
4. Watch the message pills travel `Producer → Broker → Consumer → DB`. When an ACK is lost, the broker redelivers — and the balance climbs past expected.
5. The metrics card lights up: **Δ +$200 • inflated** in yellow. This is the bug.
6. **Reset → Idempotency: ON**. Repeat. The consumer now logs `🛡️ already processed — discarded`. Balance ends at expected. Δ shows **OK** in green.
7. **Switch tool** to **Azure Service Bus + Sessions** (default: *exactly-once*) and run again. The broker's duplicate detection prevents the bug at the infra layer.

---

## File layout

```
Delivery-Guarantees/
├── index.html       # markup + favicon (inline SVG)
├── styles.css       # dark theme, animations, metrics layout
├── simulator.js     # state machine, delivery logic, UI bindings
└── README.md
```

Everything runs client-side. There is no build step, no `npm install`, no server. Just open `index.html` in any modern browser (tested on Chrome/Safari/Firefox).

---

## Architecture notes

- **State** is a single object mutated in place; UI reads from it on every animation tick.
- **Animated messages** are absolutely-positioned DOM pills moved with CSS transitions — no canvas/SVG.
- **The consumer's idempotency store** is a `Set<idempotencyKey>` (modeling Redis / inbox table).
- **The broker's dedup store** (used only in exactly-once mode) is a separate `Set` (modeling Service Bus duplicate detection / Kafka idempotent producer).
- **Retries** are bounded at 3 attempts.

---

## License

Free for educational use.
