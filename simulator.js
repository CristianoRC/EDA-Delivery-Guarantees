// ============================================================
// Delivery Guarantees Simulator — Azure + RabbitMQ + Kafka
// ============================================================

const TOOLS = {
  servicebus: {
    name: "Azure Service Bus",
    brokerLabel: "SERVICE BUS",
    brokerDesc: "Queue / Topic",
    desc: "<strong>Default:</strong> at-least-once with <code>PeekLock</code> + <code>Complete()</code>. <strong>Exactly-once</strong> via <code>RequiresDuplicateDetection=true</code> (window up to 7 days) using <code>MessageId</code>. <strong>Retry</strong> + automatic <strong>Dead-Letter Queue</strong> after N failures.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "ReceiveAndDelete mode (no PeekLock): message is removed before processing — if app crashes, it's lost.",
      "at-least-once": "PeekLock + Complete() / Abandon() — most common. Broker handles automatic retries.",
      "exactly-once": "RequiresDuplicateDetection=true with MessageId. Configurable dedup window (up to 7 days).",
    },
    suggestIdempotency: true,
  },
  "servicebus-sessions": {
    name: "Azure Service Bus + Sessions",
    brokerLabel: "SB SESSIONS",
    brokerDesc: "FIFO per SessionId",
    desc: "<strong>Sessions</strong> guarantee FIFO order per <code>SessionId</code> (e.g. per customer). Combine with <code>RequiresDuplicateDetection</code> for ordered exactly-once. Ideal for sagas/workflows per entity.",
    defaultMode: "exactly-once",
    supports: {
      "at-least-once": "Sessions guarantee FIFO but the consumer can reprocess if it crashes before Complete().",
      "exactly-once": "FIFO + duplicate detection combined: the strongest Service Bus option.",
    },
    suggestIdempotency: false,
  },
  eventhubs: {
    name: "Azure Event Hubs",
    brokerLabel: "EVENT HUBS",
    brokerDesc: "Partitions + Offsets",
    desc: "<strong>Default:</strong> at-least-once (similar to Kafka). Partitioned by <code>PartitionKey</code>. <strong>Idempotent Producer</strong> available. Consumer does manual <code>checkpoint</code> after processing. No native dedup — consumer-side idempotency is <strong>mandatory</strong>.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "Checkpoint BEFORE processing: if it crashes, event is already marked as read — may be lost.",
      "at-least-once": "Checkpoint AFTER processing (default). May reprocess on failure.",
    },
    suggestIdempotency: true,
  },
  eventgrid: {
    name: "Azure Event Grid",
    brokerLabel: "EVENT GRID",
    brokerDesc: "Pub/Sub HTTP",
    desc: "<strong>Default:</strong> at-least-once with exponential retry (24h by default) + Dead-Letter to Blob Storage. <strong>No native dedup</strong> — duplicates can occur on retries. Consumer-side idempotency is <strong>mandatory</strong>. CloudEvents 1.0 schema.",
    defaultMode: "at-least-once",
    supports: {
      "at-least-once": "Only mode: Event Grid always retries until success — no fire-and-forget, no native dedup.",
    },
    suggestIdempotency: true,
  },
  storagequeue: {
    name: "Azure Storage Queue",
    brokerLabel: "STORAGE QUEUE",
    brokerDesc: "Simple queue",
    desc: "<strong>Default:</strong> at-least-once. Simpler and cheaper than Service Bus. No ordering, no dedup, no sessions. <code>VisibilityTimeout</code> hides the message while the consumer processes. Consumer-side idempotency is <strong>mandatory</strong>.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "DeleteMessage BEFORE processing: fast but loses on failure.",
      "at-least-once": "Get + process + DeleteMessage. VisibilityTimeout makes the message reappear if no delete is sent.",
    },
    suggestIdempotency: true,
  },
  rabbitmq: {
    name: "RabbitMQ",
    brokerLabel: "RABBITMQ",
    brokerDesc: "Exchange + Queue",
    desc: "<strong>Default:</strong> at-least-once with <code>publisher confirms</code> (producer) + <code>manual ack</code> (consumer). <strong>Exactly-once is NOT native</strong> — requires consumer-side idempotency. Supports <strong>DLX</strong> (Dead Letter Exchange) and <code>quorum queues</code> for HA.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "autoAck=true: broker discards the message on send, before the consumer processes it.",
      "at-least-once": "autoAck=false + manual basicAck() after processing. Recommended mode.",
    },
    suggestIdempotency: true,
  },
  kafka: {
    name: "Apache Kafka",
    brokerLabel: "KAFKA",
    brokerDesc: "Topics + Partitions",
    desc: "<strong>Default:</strong> at-least-once. <strong>Exactly-once</strong> via idempotent producer (<code>enable.idempotence=true</code>) + transactions (<code>transactional.id</code>) + <code>isolation.level=read_committed</code>. Consumer commits offsets manually.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "enable.auto.commit=true with commit BEFORE processing. Loses on crash.",
      "at-least-once": "Manual commit after processing (default in most systems).",
      "exactly-once": "Idempotent producer + transactions + read_committed consumer. EOS (Exactly-Once Semantics).",
    },
    suggestIdempotency: true,
  },
};

const MODE_LABELS = {
  "at-most-once": "At-most-once",
  "at-least-once": "At-least-once",
  "exactly-once": "Exactly-once",
};

// ============================================================
// State
// ============================================================
const state = {
  mode: "at-least-once",
  tool: "servicebus",
  idempotency: false,
  speed: 1400,
  fails: { producer: false, network: false, ack: false, consumer: false },
  startTime: Date.now(),
  logicalSent: 0,
  physicalSent: 0,
  delivered: 0,
  duplicated: 0,
  lost: 0,
  balance: 0,
  expected: 0,
  queue: 0,
  processed: 0,
  processedKeys: new Set(),
  brokerSeen: new Set(),
  msgIdCounter: 0,
};

// ============================================================
// Helpers
// ============================================================
const $ = (id) => document.getElementById(id);

const log = (msg, level = "info") => {
  const time = ((Date.now() - state.startTime) / 1000).toFixed(2);
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = `<span class="log-time">[${time.padStart(6, " ")}s]</span><span class="log-msg ${level}">${msg}</span>`;
  $("log").appendChild(entry);
  $("log").scrollTop = $("log").scrollHeight;
};

const setPhase = (text) => {
  const el = $("phaseLabel");
  el.textContent = text;
  el.classList.add("active");
  clearTimeout(setPhase._t);
  setPhase._t = setTimeout(() => el.classList.remove("active"), 1500);
};

const updateStats = () => {
  $("statSent").textContent = state.physicalSent;
  $("statQueue").textContent = state.queue;
  $("statProcessed").textContent = state.processed;
  $("statBalance").textContent = `$ ${state.balance}`;
  $("mLogical").textContent = state.logicalSent;
  $("mDelivered").textContent = state.delivered;
  $("mDup").textContent = state.duplicated;
  $("mLost").textContent = state.lost;

  $("heroExpected").textContent = `$ ${state.expected}`;
  const actualEl = $("heroActual");
  actualEl.textContent = `$ ${state.balance}`;
  actualEl.classList.remove("warn", "danger");

  const diff = state.balance - state.expected;
  const deltaEl = $("heroDelta");
  const arrowEl = $("heroArrow");
  deltaEl.classList.remove("ok", "warn", "danger");

  if (state.expected === 0) {
    deltaEl.textContent = "Δ —";
    arrowEl.textContent = "vs";
  } else if (diff === 0) {
    deltaEl.textContent = "Δ $ 0 • OK";
    deltaEl.classList.add("ok");
    arrowEl.textContent = "=";
  } else if (diff > 0) {
    deltaEl.textContent = `Δ +$ ${diff} • inflated`;
    deltaEl.classList.add("warn");
    actualEl.classList.add("warn");
    arrowEl.textContent = "↑";
  } else {
    deltaEl.textContent = `Δ $ ${diff} • lost`;
    deltaEl.classList.add("danger");
    actualEl.classList.add("danger");
    arrowEl.textContent = "↓";
  }
};

const flash = (id) => {
  const el = $(id);
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 600);
};

const crash = (id) => {
  const el = $(id);
  el.classList.add("crash");
  setTimeout(() => el.classList.remove("crash"), 600);
};

const getNodeCenter = (id) => {
  const node = $(id);
  const stage = node.closest(".stage-grid");
  const r = node.getBoundingClientRect();
  const sr = stage.getBoundingClientRect();
  return {
    x: r.left - sr.left + r.width / 2,
    y: r.top - sr.top + r.height / 2,
  };
};

const animateMsg = (fromId, toId, label, cls = "", willLose = false) => {
  return new Promise((resolve) => {
    const layer = $("msgLayer");
    const msg = document.createElement("div");
    msg.className = `msg ${cls}`;
    msg.textContent = label;
    const from = getNodeCenter(fromId);
    const to = getNodeCenter(toId);
    msg.style.left = from.x + "px";
    msg.style.top = from.y + "px";
    msg.style.transition = `all ${state.speed}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    layer.appendChild(msg);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (willLose) {
          msg.style.left = (from.x + to.x) / 2 + "px";
          msg.style.top = (from.y + to.y) / 2 + "px";
          msg.style.opacity = "0";
          msg.style.transform = "translate(-50%, -50%) scale(0.4) rotate(-25deg)";
          msg.classList.add("lost");
        } else {
          msg.style.left = to.x + "px";
          msg.style.top = to.y + "px";
        }
      });
    });

    setTimeout(() => {
      msg.remove();
      resolve();
    }, state.speed);
  });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Delivery logic
// ============================================================
const MAX_RETRIES = 3;

async function sendLogicalMessage(amount = 100) {
  state.logicalSent++;
  state.expected += amount;
  const logicalId = ++state.msgIdCounter;
  const idempotencyKey = `tx-${logicalId}`;
  const label = `$${amount} #${logicalId}`;
  log(`📤 Producer: new transfer ${idempotencyKey} of $${amount}`, "info");
  updateStats();
  await attemptDelivery(logicalId, idempotencyKey, amount, label, 0);
}

async function attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount) {
  const mode = state.mode;

  setPhase(`Producer publishing ${idempotencyKey}...`);
  flash("nodeProducer");

  if (state.fails.producer && Math.random() < 0.10) {
    log(`❌ Producer ${idempotencyKey}: publish failed`, "danger");
    if (mode === "at-most-once") {
      state.lost++; updateStats(); return;
    }
    if (retryCount < MAX_RETRIES) {
      log(`🔁 Producer ${idempotencyKey}: retry #${retryCount + 1}`, "warn");
      await sleep(300);
      return attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount + 1);
    }
    state.lost++; updateStats(); return;
  }

  state.physicalSent++;
  updateStats();

  const networkLost = state.fails.network && Math.random() < 0.15;
  const cls = retryCount > 0 ? "retry" : "";

  setPhase(`In transit: Producer → Broker`);
  await animateMsg("nodeProducer", "nodeBroker", label, cls, networkLost);

  if (networkLost) {
    log(`📡 Network: packet ${idempotencyKey} lost on the way to broker`, "danger");
    if (mode === "at-most-once") {
      state.lost++; updateStats(); return;
    }
    if (retryCount < MAX_RETRIES) {
      log(`🔁 Producer ${idempotencyKey}: timeout, retry #${retryCount + 1}`, "warn");
      await sleep(300);
      return attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount + 1);
    }
    state.lost++; updateStats(); return;
  }

  setPhase(`Broker received ${idempotencyKey}`);
  flash("nodeBroker");

  if (mode === "exactly-once" && state.brokerSeen.has(idempotencyKey)) {
    log(`🛡️ Broker: duplicate detection discarded ${idempotencyKey}`, "info");
    return;
  }
  state.brokerSeen.add(idempotencyKey);
  state.queue++;
  log(`📨 Broker: enqueued ${idempotencyKey}`, "dim");
  updateStats();

  await sleep(300);

  state.queue--;
  setPhase(`Broker → Consumer`);
  await animateMsg("nodeBroker", "nodeConsumer", label, cls);
  flash("nodeConsumer");
  updateStats();

  setPhase(`Consumer processing ${idempotencyKey}`);
  log(`⚙️ Consumer: processing ${idempotencyKey}`, "dim");
  state.processed++;

  const isDuplicate = state.processedKeys.has(idempotencyKey);
  if (state.idempotency && isDuplicate) {
    log(`🛡️ Consumer: ${idempotencyKey} already processed — discarded (idempotency)`, "ok");
    state.duplicated++;
    updateStats();
    await sleep(200);
    return sendAck(idempotencyKey, label, mode, logicalId, amount);
  }

  state.processedKeys.add(idempotencyKey);
  state.balance += amount;
  state.delivered++;
  if (isDuplicate && !state.idempotency) {
    state.duplicated++;
    log(`⚠️ Consumer: applied ${idempotencyKey} AGAIN (no idempotency) → balance $${state.balance}`, "warn");
  } else {
    log(`✅ Consumer: applied ${idempotencyKey} → balance $${state.balance}`, "ok");
  }
  flash("nodeDb");
  updateStats();

  if (state.fails.consumer && Math.random() < 0.15) {
    crash("nodeConsumer");
    log(`💥 Consumer crashed after processing ${idempotencyKey} (ACK NOT sent!)`, "danger");
    if (mode === "at-most-once") return;
    setPhase(`Visibility timeout: broker redelivering...`);
    log(`⏰ Broker: visibility timeout, redelivering ${idempotencyKey}`, "warn");
    await sleep(500);
    return redeliverFromBroker(logicalId, idempotencyKey, amount, label);
  }

  await sleep(200);
  return sendAck(idempotencyKey, label, mode, logicalId, amount);
}

async function sendAck(idempotencyKey, label, mode, logicalId, amount) {
  const ackLost = state.fails.ack && Math.random() < 0.20;
  setPhase(`Consumer sending ACK...`);
  await animateMsg("nodeConsumer", "nodeBroker", "ACK", "ack", ackLost);

  if (ackLost) {
    log(`📡 Network: ACK for ${idempotencyKey} lost!`, "danger");
    if (mode === "at-most-once") return;
    log(`⏰ Broker: missing ACK, redelivering ${idempotencyKey}`, "warn");
    await sleep(400);
    return redeliverFromBroker(logicalId, idempotencyKey, amount, label);
  }
  log(`✔️ Broker: ACK received, commit/complete on ${idempotencyKey}`, "ok");
}

async function redeliverFromBroker(logicalId, idempotencyKey, amount, label) {
  setPhase(`Broker → Consumer (redelivery)`);
  await animateMsg("nodeBroker", "nodeConsumer", label, "dup");
  flash("nodeConsumer");

  const isDuplicate = state.processedKeys.has(idempotencyKey);
  if (state.idempotency && isDuplicate) {
    log(`🛡️ Consumer: redelivery of ${idempotencyKey} discarded (idempotency)`, "ok");
    state.duplicated++;
    updateStats();
    await sleep(200);
    return sendAck(idempotencyKey, label, state.mode, logicalId, amount);
  }

  state.processedKeys.add(idempotencyKey);
  state.balance += amount;
  state.delivered++;
  if (isDuplicate) {
    state.duplicated++;
    log(`⚠️ Consumer: reapplied ${idempotencyKey} (no idempotency) → balance $${state.balance}`, "warn");
  } else {
    log(`✅ Consumer: applied ${idempotencyKey} → balance $${state.balance}`, "ok");
  }
  flash("nodeDb");
  updateStats();
  await sleep(200);
  return sendAck(idempotencyKey, label, state.mode, logicalId, amount);
}

// ============================================================
// UI
// ============================================================
function reset() {
  state.startTime = Date.now();
  state.logicalSent = state.physicalSent = state.delivered = 0;
  state.duplicated = state.lost = state.balance = state.expected = 0;
  state.queue = state.processed = state.msgIdCounter = 0;
  state.processedKeys.clear();
  state.brokerSeen.clear();
  $("log").innerHTML = "";
  $("msgLayer").innerHTML = "";
  setPhase("Ready");
  updateStats();
  log("🔄 Simulation reset", "info");
}

function applyTool() {
  const t = TOOLS[state.tool];
  $("toolInfo").innerHTML = `<strong>${t.name}</strong> — ${t.desc}`;
  $("brokerLabel").textContent = t.brokerLabel;
  $("brokerDesc").textContent = t.brokerDesc;

  // Enable/disable mode tabs based on what this tool supports
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    const mode = tab.dataset.mode;
    const supported = t.supports.hasOwnProperty(mode);
    tab.classList.toggle("disabled", !supported);
    tab.classList.toggle("active", supported && mode === t.defaultMode);
    if (supported) {
      tab.title = t.supports[mode];
      tab.removeAttribute("aria-disabled");
    } else {
      tab.title = `${t.name} does not natively support ${MODE_LABELS[mode]}.`;
      tab.setAttribute("aria-disabled", "true");
    }
  });

  state.mode = t.defaultMode;
  $("idempotencyToggle").checked = t.suggestIdempotency;
  state.idempotency = t.suggestIdempotency;
  $("idemLabel").textContent = state.idempotency ? "ON" : "OFF";
  $("idemLabel").style.color = state.idempotency ? "var(--ok)" : "var(--text-dim)";
  log(`🔧 Tool: ${t.name} • supported: ${Object.keys(t.supports).map(m => MODE_LABELS[m]).join(", ")} • default: ${MODE_LABELS[t.defaultMode]}`, "info");
}

// Bindings
document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.classList.contains("disabled")) {
      log(`⛔ ${TOOLS[state.tool].name} does not support ${MODE_LABELS[tab.dataset.mode]}`, "warn");
      return;
    }
    document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.mode = tab.dataset.mode;
    log(`⚙️ Guarantee changed to: ${MODE_LABELS[state.mode]}`, "info");
  });
});

$("toolSelect").addEventListener("change", (e) => {
  state.tool = e.target.value;
  applyTool();
});

$("idempotencyToggle").addEventListener("change", (e) => {
  state.idempotency = e.target.checked;
  $("idemLabel").textContent = state.idempotency ? "ON" : "OFF";
  $("idemLabel").style.color = state.idempotency ? "var(--ok)" : "var(--text-dim)";
  log(`🛡️ Idempotency: ${state.idempotency ? "ENABLED" : "DISABLED"}`, "info");
});

$("speedSelect").addEventListener("change", (e) => {
  state.speed = parseInt(e.target.value, 10);
});

$("failProducer").addEventListener("change", (e) => { state.fails.producer = e.target.checked; });
$("failNetwork").addEventListener("change", (e) => { state.fails.network = e.target.checked; });
$("failAck").addEventListener("change", (e) => { state.fails.ack = e.target.checked; });
$("failConsumer").addEventListener("change", (e) => { state.fails.consumer = e.target.checked; });

$("send1").addEventListener("click", () => sendLogicalMessage(100));
$("send5").addEventListener("click", async () => {
  for (let i = 0; i < 5; i++) {
    sendLogicalMessage(100);
    await sleep(Math.max(300, state.speed * 0.5));
  }
});
$("sendBurst").addEventListener("click", async () => {
  ["failProducer", "failNetwork", "failAck", "failConsumer"].forEach((id) => {
    $(id).checked = true;
  });
  state.fails = { producer: true, network: true, ack: true, consumer: true };
  log("🌪️ Chaos burst: 15 messages with ALL failures enabled", "warn");
  for (let i = 0; i < 15; i++) {
    sendLogicalMessage(100);
    await sleep(Math.max(250, state.speed * 0.4));
  }
});

$("resetBtn").addEventListener("click", reset);

// Init
applyTool();
updateStats();
setPhase("Ready — pick your config and click '+1'");
log("✨ Simulator ready.", "info");
