// ============================================================
// Delivery Guarantees Simulator — Scenarios + Tools
// ============================================================

const TOOLS = {
  servicebus: {
    name: "Azure Service Bus",
    brokerLabel: "SERVICE BUS",
    brokerDesc: "Queue / Topic",
    desc: "<strong>Default:</strong> at-least-once with <code>PeekLock</code> + <code>Complete()</code>. <strong>Exactly-once</strong> via <code>RequiresDuplicateDetection=true</code> (window up to 7 days). <strong>Native DLQ</strong> after MaxDeliveryCount is exceeded.",
    supports: ["at-most-once", "at-least-once", "exactly-once"],
    supportsDLQ: true,
  },
  "servicebus-sessions": {
    name: "Azure Service Bus + Sessions",
    brokerLabel: "SB SESSIONS",
    brokerDesc: "FIFO per SessionId",
    desc: "<strong>Sessions</strong> guarantee FIFO order per <code>SessionId</code>. Combine with duplicate detection for ordered exactly-once. <strong>Native DLQ</strong> after MaxDeliveryCount.",
    supports: ["at-least-once", "exactly-once"],
    supportsDLQ: true,
  },
  eventhubs: {
    name: "Azure Event Hubs",
    brokerLabel: "EVENT HUBS",
    brokerDesc: "Partitions + Offsets",
    desc: "<strong>Default:</strong> at-least-once (Kafka-like). Partitioned by <code>PartitionKey</code>. Checkpoint-based. No native dedup. <strong>No native DLQ</strong> — must be implemented manually (separate topic / event handler).",
    supports: ["at-most-once", "at-least-once"],
    supportsDLQ: false,
  },
  eventgrid: {
    name: "Azure Event Grid",
    brokerLabel: "EVENT GRID",
    brokerDesc: "Pub/Sub HTTP",
    desc: "<strong>Default:</strong> at-least-once with exponential retry (24h) + <strong>Dead-Letter to Blob Storage</strong>. CloudEvents 1.0 schema. No native dedup.",
    supports: ["at-least-once"],
    supportsDLQ: true,
  },
  storagequeue: {
    name: "Azure Storage Queue",
    brokerLabel: "STORAGE QUEUE",
    brokerDesc: "Simple queue",
    desc: "<strong>Default:</strong> at-least-once. Simpler and cheaper than Service Bus. <code>VisibilityTimeout</code> hides the message while consumer processes. <strong>No native DLQ</strong> — implement via DequeueCount check.",
    supports: ["at-most-once", "at-least-once"],
    supportsDLQ: false,
  },
  rabbitmq: {
    name: "RabbitMQ",
    brokerLabel: "RABBITMQ",
    brokerDesc: "Exchange + Queue",
    desc: "<strong>Default:</strong> at-least-once with <code>publisher confirms</code> + <code>manual ack</code>. <strong>Native DLX</strong> (Dead Letter Exchange) on nack/reject or TTL expiry. Quorum queues for HA.",
    supports: ["at-most-once", "at-least-once"],
    supportsDLQ: true,
  },
  kafka: {
    name: "Apache Kafka",
    brokerLabel: "KAFKA",
    brokerDesc: "Topics + Partitions",
    desc: "<strong>Default:</strong> at-least-once. <strong>Exactly-once</strong> via idempotent producer + transactions (EOS). <strong>No native DLQ</strong> — common pattern is a dedicated dead-letter topic.",
    supports: ["at-most-once", "at-least-once", "exactly-once"],
    supportsDLQ: false,
  },
};

const SCENARIOS = {
  "at-most-once": {
    name: "At-most-once",
    icon: "💨",
    mode: "at-most-once",
    showIdempotency: false,
    showDLQ: false,
    defaultTool: "storagequeue",
  },
  "at-least-once": {
    name: "At-least-once",
    icon: "🔁",
    mode: "at-least-once",
    showIdempotency: true,
    showDLQ: false,
    defaultTool: "servicebus",
  },
  "exactly-once": {
    name: "Exactly-once",
    icon: "🛡️",
    mode: "exactly-once",
    showIdempotency: true,
    showDLQ: false,
    defaultTool: "servicebus",
  },
  "dlq": {
    name: "Dead Letter Queue",
    icon: "🪦",
    mode: "at-least-once",
    showIdempotency: false,
    showDLQ: true,
    defaultTool: "servicebus",
  },
};

// ============================================================
// State
// ============================================================
const state = {
  scenario: "at-least-once",
  mode: "at-least-once",
  tool: "servicebus",
  idempotency: false,
  speed: 1400,
  fails: { producer: false, network: false, ack: false, consumer: false },
  // DLQ scenario
  maxDeliveryCount: 3,
  poisonRate: 30, // %
  // counters
  startTime: Date.now(),
  logicalSent: 0,
  physicalSent: 0,
  delivered: 0,
  duplicated: 0,
  lost: 0,
  deadLettered: 0,
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

    setTimeout(() => { msg.remove(); resolve(); }, state.speed);
  });
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Metrics rendering — depends on scenario
// ============================================================
function renderMetricsCard() {
  const isDLQ = state.scenario === "dlq";
  $("metricsCard").innerHTML = isDLQ
    ? `
      <div class="hero">
        <div class="hero-side">
          <span class="hero-tag">Successfully processed</span>
          <span class="hero-num" id="heroSuccess">0</span>
        </div>
        <div class="hero-divider">
          <span class="hero-arrow">vs</span>
          <span class="hero-delta" id="heroDelta">— sent</span>
        </div>
        <div class="hero-side hero-actual">
          <span class="hero-tag">Dead-lettered</span>
          <span class="hero-num" id="heroActual">0</span>
        </div>
      </div>
      <div class="mini-stats">
        <div class="mini-stat"><span class="dot dot-blue"></span><b id="mLogical">0</b> sent</div>
        <div class="mini-stat"><span class="dot dot-green"></span><b id="mDelivered">0</b> delivered</div>
        <div class="mini-stat"><span class="dot dot-yellow"></span><b id="mDup">0</b> redelivered</div>
        <div class="mini-stat"><span class="dot dot-dlq"></span><b id="mDlq">0</b> in DLQ</div>
      </div>
    `
    : `
      <div class="hero">
        <div class="hero-side">
          <span class="hero-tag">Expected</span>
          <span class="hero-num" id="heroExpected">$ 0</span>
        </div>
        <div class="hero-divider">
          <span class="hero-arrow" id="heroArrow">vs</span>
          <span class="hero-delta" id="heroDelta">Δ $ 0</span>
        </div>
        <div class="hero-side hero-actual">
          <span class="hero-tag">Actual in DB</span>
          <span class="hero-num" id="heroActual">$ 0</span>
        </div>
      </div>
      <div class="mini-stats">
        <div class="mini-stat"><span class="dot dot-blue"></span><b id="mLogical">0</b> sent</div>
        <div class="mini-stat"><span class="dot dot-green"></span><b id="mDelivered">0</b> delivered</div>
        <div class="mini-stat"><span class="dot dot-yellow"></span><b id="mDup">0</b> duplicated</div>
        <div class="mini-stat"><span class="dot dot-red"></span><b id="mLost">0</b> lost</div>
      </div>
    `;
}

const updateStats = () => {
  $("statSent").textContent = state.physicalSent;
  $("statQueue").textContent = state.queue;
  $("statProcessed").textContent = state.processed;
  $("statBalance").textContent = `$ ${state.balance}`;
  $("statDlq").textContent = state.deadLettered;

  const isDLQ = state.scenario === "dlq";

  if (isDLQ) {
    $("heroSuccess").textContent = state.delivered;
    $("heroActual").textContent = state.deadLettered;
    $("mLogical").textContent = state.logicalSent;
    $("mDelivered").textContent = state.delivered;
    $("mDup").textContent = state.duplicated;
    $("mDlq").textContent = state.deadLettered;
    const deltaEl = $("heroDelta");
    deltaEl.classList.remove("ok", "warn", "danger");
    if (state.logicalSent === 0) {
      deltaEl.textContent = "— sent";
    } else {
      const rate = ((state.deadLettered / state.logicalSent) * 100).toFixed(0);
      deltaEl.textContent = `${rate}% poisoned`;
      if (state.deadLettered === 0) deltaEl.classList.add("ok");
      else if (rate < 50) deltaEl.classList.add("warn");
      else deltaEl.classList.add("danger");
    }
  } else {
    $("heroExpected").textContent = `$ ${state.expected}`;
    const actualEl = $("heroActual");
    actualEl.textContent = `$ ${state.balance}`;
    actualEl.classList.remove("warn", "danger");
    $("mLogical").textContent = state.logicalSent;
    $("mDelivered").textContent = state.delivered;
    $("mDup").textContent = state.duplicated;
    $("mLost").textContent = state.lost;
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
  }
};

// ============================================================
// Settings panel — contextual to scenario
// ============================================================
function renderSettings() {
  const sc = SCENARIOS[state.scenario];
  const container = $("settingsContent");
  let html = "";

  if (sc.showIdempotency) {
    html += `
      <div class="setting-row">
        <span class="setting-label">Consumer idempotency</span>
        <div class="switch-inline">
          <label class="switch">
            <input type="checkbox" id="idempotencyToggle" ${state.idempotency ? "checked" : ""} />
            <span class="slider"></span>
          </label>
          <span class="switch-state" id="idemLabel">${state.idempotency ? "ON" : "OFF"}</span>
        </div>
        <span class="setting-hint">Discards repeated messages by <code style="font-size:9px">idempotency_key</code> (Redis / inbox table).</span>
      </div>
    `;
  }

  if (sc.showDLQ) {
    html += `
      <div class="setting-row">
        <span class="setting-label">Max delivery count <span class="setting-value" id="maxDeliveryValue">${state.maxDeliveryCount}</span></span>
        <input type="range" id="maxDeliverySlider" min="1" max="10" value="${state.maxDeliveryCount}" />
        <span class="setting-hint">After this many failed delivery attempts, the broker moves the message to the DLQ.</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">Poison message rate <span class="setting-value" id="poisonValue">${state.poisonRate}%</span></span>
        <input type="range" id="poisonSlider" min="0" max="100" step="5" value="${state.poisonRate}" />
        <span class="setting-hint">Percentage of messages that always fail processing — they will be dead-lettered.</span>
      </div>
    `;
  }

  if (!html) {
    html = `<span class="setting-hint" style="font-size:11px;">No extra settings for this scenario. Just inject failures and watch what happens.</span>`;
  }

  container.innerHTML = html;

  // re-bind dynamic controls
  const idem = $("idempotencyToggle");
  if (idem) {
    idem.addEventListener("change", (e) => {
      state.idempotency = e.target.checked;
      $("idemLabel").textContent = state.idempotency ? "ON" : "OFF";
      $("idemLabel").style.color = state.idempotency ? "var(--ok)" : "var(--text-dim)";
      log(`🛡️ Idempotency: ${state.idempotency ? "ENABLED" : "DISABLED"}`, "info");
    });
  }
  const maxSlider = $("maxDeliverySlider");
  if (maxSlider) {
    maxSlider.addEventListener("input", (e) => {
      state.maxDeliveryCount = parseInt(e.target.value, 10);
      $("maxDeliveryValue").textContent = state.maxDeliveryCount;
    });
  }
  const poisonSlider = $("poisonSlider");
  if (poisonSlider) {
    poisonSlider.addEventListener("input", (e) => {
      state.poisonRate = parseInt(e.target.value, 10);
      $("poisonValue").textContent = state.poisonRate + "%";
    });
  }
}

// ============================================================
// Delivery logic (non-DLQ)
// ============================================================
const MAX_RETRIES = 3;

async function sendLogicalMessage(amount = 100) {
  if (state.scenario === "dlq") {
    return sendDLQMessage(amount);
  }

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
    if (mode === "at-most-once") { state.lost++; updateStats(); return; }
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
    if (mode === "at-most-once") { state.lost++; updateStats(); return; }
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
// DLQ scenario delivery logic
// ============================================================
async function sendDLQMessage() {
  state.logicalSent++;
  const logicalId = ++state.msgIdCounter;
  const id = `msg-${logicalId}`;
  const isPoison = Math.random() * 100 < state.poisonRate;
  const label = `${isPoison ? "☠️" : "📩"} #${logicalId}`;
  log(`📤 Producer: published ${id}${isPoison ? " (POISON)" : ""}`, "info");
  updateStats();
  await dlqAttempt(id, label, isPoison, 1);
}

async function dlqAttempt(id, label, isPoison, deliveryCount) {
  setPhase(`Delivery attempt ${deliveryCount} of ${id}`);
  flash("nodeProducer");
  state.physicalSent++;
  updateStats();

  // Producer → Broker (first time only; redeliveries go broker → consumer directly)
  if (deliveryCount === 1) {
    await animateMsg("nodeProducer", "nodeBroker", label, isPoison ? "poison" : "");
    flash("nodeBroker");
    state.queue++;
    log(`📨 Broker: enqueued ${id}`, "dim");
    updateStats();
    await sleep(200);
    state.queue--;
    updateStats();
  } else {
    log(`⏰ Broker: delivery attempt ${deliveryCount} for ${id}`, "warn");
  }

  setPhase(`Broker → Consumer (attempt ${deliveryCount})`);
  await animateMsg("nodeBroker", "nodeConsumer", label, isPoison ? "poison" : (deliveryCount > 1 ? "dup" : ""));
  flash("nodeConsumer");

  // Processing: poison always fails; non-poison might fail by random crash
  const willFail = isPoison || (state.fails.consumer && Math.random() < 0.4);

  if (!willFail) {
    state.delivered++;
    log(`✅ Consumer: processed ${id} successfully (attempt ${deliveryCount})`, "ok");
    flash("nodeDb");
    updateStats();
    await sleep(200);
    await animateMsg("nodeConsumer", "nodeBroker", "ACK", "ack");
    log(`✔️ Broker: ACK received for ${id}`, "ok");
    return;
  }

  // Failure
  crash("nodeConsumer");
  if (isPoison) {
    log(`☠️ Consumer: ${id} is POISON — processing failed (attempt ${deliveryCount})`, "danger");
  } else {
    log(`💥 Consumer crashed processing ${id} (attempt ${deliveryCount})`, "danger");
  }
  if (deliveryCount > 1) state.duplicated++;
  updateStats();
  await sleep(400);

  // Decide: retry or DLQ?
  if (deliveryCount >= state.maxDeliveryCount) {
    setPhase(`Max retries hit — moving ${id} to DLQ`);
    log(`🪦 Broker: ${id} exceeded MaxDeliveryCount (${state.maxDeliveryCount}) → DLQ`, "danger");
    await animateMsg("nodeBroker", "nodeDlq", label, "dead");
    flash("nodeDlq");
    state.deadLettered++;
    updateStats();
    return;
  }

  // Otherwise, retry
  await sleep(300);
  return dlqAttempt(id, label, isPoison, deliveryCount + 1);
}

// ============================================================
// Tool & scenario application
// ============================================================
function applyTool() {
  const t = TOOLS[state.tool];
  $("toolInfo").innerHTML = `<strong>${t.name}</strong> — ${t.desc}`;
  $("brokerLabel").textContent = t.brokerLabel;
  $("brokerDesc").textContent = t.brokerDesc;
}

function applyScenario() {
  const sc = SCENARIOS[state.scenario];
  state.mode = sc.mode;

  // Side menu active state
  document.querySelectorAll(".scenario-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.scenario === state.scenario);
  });

  // Stage layout: add/remove DLQ
  $("stageGrid").classList.toggle("dlq-mode", sc.showDLQ);

  // Idempotency reset based on scenario
  if (sc.showIdempotency) {
    // keep user choice if same scenario type; default OFF on switch
  } else {
    state.idempotency = false;
  }

  // Filter tool options
  filterToolsForScenario();

  // Render settings + metrics
  renderSettings();
  renderMetricsCard();
  updateStats();

  log(`🎯 Scenario: ${sc.name} (mode: ${state.mode})`, "info");
}

function filterToolsForScenario() {
  const sc = SCENARIOS[state.scenario];
  const select = $("toolSelect");

  Array.from(select.options).forEach((opt) => {
    if (!opt.value) return;
    const tool = TOOLS[opt.value];
    if (!tool) return;
    let supported;
    if (sc.showDLQ) {
      supported = tool.supportsDLQ;
    } else {
      supported = tool.supports.includes(sc.mode);
    }
    opt.disabled = !supported;
    opt.textContent = supported
      ? tool.name
      : `${tool.name} — not native`;
  });

  // If current tool isn't valid, switch to scenario's default
  const currentTool = TOOLS[state.tool];
  const currentValid = sc.showDLQ ? currentTool.supportsDLQ : currentTool.supports.includes(sc.mode);
  if (!currentValid) {
    state.tool = sc.defaultTool;
    select.value = sc.defaultTool;
    applyTool();
  }
}

function reset() {
  state.startTime = Date.now();
  state.logicalSent = state.physicalSent = state.delivered = 0;
  state.duplicated = state.lost = state.deadLettered = 0;
  state.balance = state.expected = 0;
  state.queue = state.processed = state.msgIdCounter = 0;
  state.processedKeys.clear();
  state.brokerSeen.clear();
  $("log").innerHTML = "";
  $("msgLayer").innerHTML = "";
  setPhase("Ready");
  updateStats();
  log("🔄 Simulation reset", "info");
}

// ============================================================
// Event bindings
// ============================================================
document.querySelectorAll(".scenario-item").forEach((item) => {
  item.addEventListener("click", () => {
    state.scenario = item.dataset.scenario;
    reset();
    applyScenario();
  });
});

$("toolSelect").addEventListener("change", (e) => {
  if (e.target.selectedOptions[0].disabled) return;
  state.tool = e.target.value;
  applyTool();
  log(`🔧 Tool: ${TOOLS[state.tool].name}`, "info");
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

// ============================================================
// Init
// ============================================================
applyTool();
applyScenario();
setPhase("Ready — pick a scenario on the left and click '+1'");
log("✨ Simulator ready.", "info");
