// ============================================================
// Simulador de Delivery Guarantees em EDA — Azure + RabbitMQ
// ============================================================

const TOOLS = {
  servicebus: {
    name: "Azure Service Bus",
    brokerLabel: "SERVICE BUS",
    brokerDesc: "Queue / Topic",
    desc: "<strong>Padrão:</strong> at-least-once com <code>PeekLock</code> + <code>Complete()</code>. <strong>Exactly-once</strong> via <code>RequiresDuplicateDetection=true</code> (janela de até 7 dias) usando <code>MessageId</code>. <strong>Retry</strong> + <strong>Dead-Letter Queue</strong> automática após N falhas.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "Modo ReceiveAndDelete (sem PeekLock): mensagem é removida antes de processar — se a app crashar, perde.",
      "at-least-once": "PeekLock + Complete() / Abandon() — mais comum. Retries automáticos pelo broker.",
      "exactly-once": "RequiresDuplicateDetection=true com MessageId. Janela de dedup configurável (até 7 dias).",
    },
    suggestIdempotency: true,
  },
  "servicebus-sessions": {
    name: "Azure Service Bus + Sessions",
    brokerLabel: "SB SESSIONS",
    brokerDesc: "FIFO por SessionId",
    desc: "<strong>Sessions</strong> garantem ordem FIFO por <code>SessionId</code> (ex: por cliente). Combine com <code>RequiresDuplicateDetection</code> para exactly-once ordenado. Ideal para saga/workflow por entidade.",
    defaultMode: "exactly-once",
    supports: {
      "at-least-once": "Sessões garantem FIFO mas o consumer pode reprocessar se crashar antes do Complete().",
      "exactly-once": "FIFO + duplicate detection juntos: a opção mais forte do Service Bus.",
    },
    suggestIdempotency: false,
  },
  eventhubs: {
    name: "Azure Event Hubs",
    brokerLabel: "EVENT HUBS",
    brokerDesc: "Partições + Offsets",
    desc: "<strong>Padrão:</strong> at-least-once (similar ao Kafka). Particionado por <code>PartitionKey</code>. <strong>Idempotent Producer</strong> disponível. Consumer faz <code>checkpoint</code> manual após processar. Sem dedup nativo — idempotência no consumer é <strong>obrigatória</strong>.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "Checkpoint ANTES de processar: se crashar, evento já marcou como lido — pode perder.",
      "at-least-once": "Checkpoint DEPOIS de processar (padrão). Pode reprocessar em caso de falha.",
    },
    suggestIdempotency: true,
  },
  eventgrid: {
    name: "Azure Event Grid",
    brokerLabel: "EVENT GRID",
    brokerDesc: "Pub/Sub HTTP",
    desc: "<strong>Padrão:</strong> at-least-once com retry exponencial (24h por padrão) + Dead-Letter para Blob Storage. <strong>Sem dedup nativo</strong> — pode entregar duplicatas em retries. Idempotência no consumer é <strong>obrigatória</strong>. Schema CloudEvents 1.0.",
    defaultMode: "at-least-once",
    supports: {
      "at-least-once": "Único modo: Event Grid sempre tenta entregar com retry — não há opção de fire-and-forget nem dedup nativo.",
    },
    suggestIdempotency: true,
  },
  storagequeue: {
    name: "Azure Storage Queue",
    brokerLabel: "STORAGE QUEUE",
    brokerDesc: "Fila simples",
    desc: "<strong>Padrão:</strong> at-least-once. Mais simples e barato que Service Bus. Sem ordem garantida, sem dedup, sem sessions. <code>VisibilityTimeout</code> esconde a msg enquanto o consumer processa. Idempotência no consumer é <strong>obrigatória</strong>.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "DeleteMessage ANTES de processar: rápido mas perde em falha.",
      "at-least-once": "Get + processa + DeleteMessage. VisibilityTimeout faz a msg reaparecer se não houver delete.",
    },
    suggestIdempotency: true,
  },
  rabbitmq: {
    name: "RabbitMQ",
    brokerLabel: "RABBITMQ",
    brokerDesc: "Exchange + Queue",
    desc: "<strong>Padrão:</strong> at-least-once com <code>publisher confirms</code> (producer) + <code>manual ack</code> (consumer). <strong>Exactly-once NÃO é nativo</strong> — exige idempotência. Suporta <strong>DLX</strong> (Dead Letter Exchange) e <code>quorum queues</code> para HA.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "autoAck=true: broker descarta a msg ao enviar, antes do consumer processar.",
      "at-least-once": "autoAck=false + basicAck() manual após processar. Modo recomendado.",
    },
    suggestIdempotency: true,
  },
  kafka: {
    name: "Apache Kafka",
    brokerLabel: "KAFKA",
    brokerDesc: "Tópicos + Partições",
    desc: "<strong>Padrão:</strong> at-least-once. <strong>Exactly-once</strong> via produtor idempotente (<code>enable.idempotence=true</code>) + transações (<code>transactional.id</code>) + <code>isolation.level=read_committed</code>. Consumer commit offset manual.",
    defaultMode: "at-least-once",
    supports: {
      "at-most-once": "enable.auto.commit=true com commit ANTES do processamento. Perde em crash.",
      "at-least-once": "Commit manual após processar (padrão na maioria dos sistemas).",
      "exactly-once": "Idempotent producer + transações + read_committed no consumer. EOS (Exactly-Once Semantics).",
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
// Estado
// ============================================================
const state = {
  mode: "at-least-once",
  tool: "servicebus",
  idempotency: false,
  speed: 1400, // ms por animação
  fails: {
    producer: false,
    network: false,
    ack: false,
    consumer: false,
  },
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
  $("statBalance").textContent = `R$ ${state.balance}`;
  $("mLogical").textContent = state.logicalSent;
  $("mDelivered").textContent = state.delivered;
  $("mDup").textContent = state.duplicated;
  $("mLost").textContent = state.lost;

  // Hero
  $("heroExpected").textContent = `R$ ${state.expected}`;
  const actualEl = $("heroActual");
  actualEl.textContent = `R$ ${state.balance}`;
  actualEl.classList.remove("warn", "danger");

  const diff = state.balance - state.expected;
  const deltaEl = $("heroDelta");
  const arrowEl = $("heroArrow");
  deltaEl.classList.remove("ok", "warn", "danger");

  if (state.expected === 0) {
    deltaEl.textContent = "Δ —";
    arrowEl.textContent = "vs";
  } else if (diff === 0) {
    deltaEl.textContent = "Δ R$ 0 • OK";
    deltaEl.classList.add("ok");
    arrowEl.textContent = "=";
  } else if (diff > 0) {
    deltaEl.textContent = `Δ +R$ ${diff} • inflado`;
    deltaEl.classList.add("warn");
    actualEl.classList.add("warn");
    arrowEl.textContent = "↑";
  } else {
    deltaEl.textContent = `Δ R$ ${diff} • perdas`;
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
// Lógica de entrega
// ============================================================
const MAX_RETRIES = 3;

async function sendLogicalMessage(amount = 100) {
  state.logicalSent++;
  state.expected += amount;
  const logicalId = ++state.msgIdCounter;
  const idempotencyKey = `tx-${logicalId}`;
  const label = `R$${amount} #${logicalId}`;
  log(`📤 Producer: nova transferência ${idempotencyKey} de R$${amount}`, "info");
  updateStats();
  await attemptDelivery(logicalId, idempotencyKey, amount, label, 0);
}

async function attemptDelivery(logicalId, idempotencyKey, amount, label, retryCount) {
  const mode = state.mode;

  setPhase(`Producer publicando ${idempotencyKey}...`);
  flash("nodeProducer");

  if (state.fails.producer && Math.random() < 0.10) {
    log(`❌ Producer ${idempotencyKey}: falha ao publicar`, "danger");
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

  setPhase(`Trafegando: Producer → Broker`);
  await animateMsg("nodeProducer", "nodeBroker", label, cls, networkLost);

  if (networkLost) {
    log(`📡 Rede: pacote ${idempotencyKey} perdido a caminho do broker`, "danger");
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

  // Broker recebe
  setPhase(`Broker recebeu ${idempotencyKey}`);
  flash("nodeBroker");

  if (mode === "exactly-once" && state.brokerSeen.has(idempotencyKey)) {
    log(`🛡️ Broker: duplicate detection descartou ${idempotencyKey}`, "info");
    return;
  }
  state.brokerSeen.add(idempotencyKey);
  state.queue++;
  log(`📨 Broker: enfileirou ${idempotencyKey}`, "dim");
  updateStats();

  await sleep(300);

  // Broker → Consumer
  state.queue--;
  setPhase(`Broker → Consumer`);
  await animateMsg("nodeBroker", "nodeConsumer", label, cls);
  flash("nodeConsumer");
  updateStats();

  // Consumer processa
  setPhase(`Consumer processando ${idempotencyKey}`);
  log(`⚙️ Consumer: processando ${idempotencyKey}`, "dim");
  state.processed++;

  const isDuplicate = state.processedKeys.has(idempotencyKey);
  if (state.idempotency && isDuplicate) {
    log(`🛡️ Consumer: ${idempotencyKey} já processada — descartada (idempotência)`, "ok");
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
    log(`⚠️ Consumer: aplicou ${idempotencyKey} DE NOVO (sem idempotência) → saldo R$${state.balance}`, "warn");
  } else {
    log(`✅ Consumer: aplicou ${idempotencyKey} → saldo R$${state.balance}`, "ok");
  }
  flash("nodeDb");
  updateStats();

  if (state.fails.consumer && Math.random() < 0.15) {
    crash("nodeConsumer");
    log(`💥 Consumer crashou após processar ${idempotencyKey} (ACK NÃO enviado!)`, "danger");
    if (mode === "at-most-once") return;
    setPhase(`Visibility timeout: broker reentregando...`);
    log(`⏰ Broker: visibility timeout, reentregando ${idempotencyKey}`, "warn");
    await sleep(500);
    return redeliverFromBroker(logicalId, idempotencyKey, amount, label);
  }

  await sleep(200);
  return sendAck(idempotencyKey, label, mode, logicalId, amount);
}

async function sendAck(idempotencyKey, label, mode, logicalId, amount) {
  const ackLost = state.fails.ack && Math.random() < 0.20;
  setPhase(`Consumer enviando ACK...`);
  await animateMsg("nodeConsumer", "nodeBroker", "ACK", "ack", ackLost);

  if (ackLost) {
    log(`📡 Rede: ACK de ${idempotencyKey} perdido!`, "danger");
    if (mode === "at-most-once") return;
    log(`⏰ Broker: ACK ausente, reentregando ${idempotencyKey}`, "warn");
    await sleep(400);
    return redeliverFromBroker(logicalId, idempotencyKey, amount, label);
  }
  log(`✔️ Broker: ACK recebido, commit/complete em ${idempotencyKey}`, "ok");
}

async function redeliverFromBroker(logicalId, idempotencyKey, amount, label) {
  setPhase(`Broker → Consumer (reentrega)`);
  await animateMsg("nodeBroker", "nodeConsumer", label, "dup");
  flash("nodeConsumer");

  const isDuplicate = state.processedKeys.has(idempotencyKey);
  if (state.idempotency && isDuplicate) {
    log(`🛡️ Consumer: reentrega de ${idempotencyKey} descartada (idempotência)`, "ok");
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
    log(`⚠️ Consumer: reaplicou ${idempotencyKey} (sem idempotência) → saldo R$${state.balance}`, "warn");
  } else {
    log(`✅ Consumer: aplicou ${idempotencyKey} → saldo R$${state.balance}`, "ok");
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
  setPhase("Pronto");
  updateStats();
  log("🔄 Simulação reiniciada", "info");
  updateExplainer();
}

function applyTool() {
  const t = TOOLS[state.tool];
  $("toolInfo").innerHTML = `<strong>${t.name}</strong> — ${t.desc}`;
  $("brokerLabel").textContent = t.brokerLabel;
  $("brokerDesc").textContent = t.brokerDesc;

  // Atualiza disponibilidade das abas
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    const mode = tab.dataset.mode;
    const supported = t.supports.hasOwnProperty(mode);
    tab.classList.toggle("disabled", !supported);
    tab.classList.toggle("active", supported && mode === t.defaultMode);
    if (supported) {
      tab.title = t.supports[mode];
      tab.removeAttribute("aria-disabled");
    } else {
      tab.title = `${t.name} não suporta ${MODE_LABELS[mode]} nativamente.`;
      tab.setAttribute("aria-disabled", "true");
    }
  });

  state.mode = t.defaultMode;
  $("idempotencyToggle").checked = t.suggestIdempotency;
  state.idempotency = t.suggestIdempotency;
  $("idemLabel").textContent = state.idempotency ? "ON" : "OFF";
  $("idemLabel").style.color = state.idempotency ? "var(--ok)" : "var(--text-dim)";
  log(`🔧 Ferramenta: ${t.name} • garantias suportadas: ${Object.keys(t.supports).map(m => MODE_LABELS[m]).join(", ")} • padrão: ${MODE_LABELS[t.defaultMode]}`, "info");
}

function updateExplainer() { /* removido — info agora vive no tool-info bar */ }

// Bindings
document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".mode-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.mode = tab.dataset.mode;
    log(`⚙️ Garantia alterada para: ${state.mode}`, "info");
    updateExplainer();
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
  log(`🛡️ Idempotência: ${state.idempotency ? "ATIVADA" : "DESATIVADA"}`, "info");
  updateExplainer();
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
  log("🌪️ Rajada: 15 mensagens com TODAS as falhas ativadas", "warn");
  for (let i = 0; i < 15; i++) {
    sendLogicalMessage(100);
    await sleep(Math.max(250, state.speed * 0.4));
  }
});

$("resetBtn").addEventListener("click", reset);

// Init
applyTool();
updateStats();
setPhase("Pronto — escolha a configuração e clique em '+1 mensagem'");
log("✨ Simulador pronto.", "info");
