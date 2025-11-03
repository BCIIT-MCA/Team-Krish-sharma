// home.js - Neuro Nexus frontend (merged final version)

// --- Config / thresholds ---
const MQTT_BROKER = "wss://test.mosquitto.org:8081";
const MQTT_TOPIC = "neuroNexus/eeg";

const SEIZURE_GAMMA_THRESHOLD = 3.5;
const STRESS_BETA_THRESHOLD = 3.0;

const SEIZURE_START_MS = 15000;              // seizure starts after 15s
const SEIZURE_DURATION_MS = 20000;           // lasts for 20s
const STRESS_DELAY_AFTER_SEIZURE_MS = 10000; // 10s after seizure before stress
const STRESS_DURATION_MS = 20000;            // stress lasts 20s
const DASHBOARD_INTERVAL_MS = 600;

// --- Runtime state ---
let mqttClient = null;
let latestBands = null;
let running = false;
let seizureMode = false;
let stressMode = false;
let seizureStartTime = null;
let seizureStopTime = null;
let stressStartTime = null;
let stressStopTime = null;
let dashboardTimer = null;
let simulationStartTime = null;

// --- Alert popup ---
const alertPopup = document.createElement("div");
alertPopup.style.position = "fixed";
alertPopup.style.top = "20px";
alertPopup.style.left = "50%";
alertPopup.style.transform = "translateX(-50%)";
alertPopup.style.padding = "12px 20px";
alertPopup.style.borderRadius = "8px";
alertPopup.style.color = "#fff";
alertPopup.style.fontWeight = "600";
alertPopup.style.fontSize = "0.95rem";
alertPopup.style.display = "none";
alertPopup.style.boxShadow = "0 6px 18px rgba(0,0,0,0.4)";
alertPopup.style.zIndex = "99999";
document.body.appendChild(alertPopup);

function showAlert(msg, bg = "rgba(231,76,60,0.95)") {
  alertPopup.innerText = msg;
  alertPopup.style.background = bg;
  alertPopup.style.display = "block";
}
function hideAlert() { alertPopup.style.display = "none"; }

// --- Helper functions ---
function generateBandEnergies() {
  const bands = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
  Object.keys(bands).forEach(k => bands[k] = +(Math.random() * 1.2).toFixed(2));
  return bands;
}

const BAR_LABELS = {
  delta: "Δ Delta", theta: "Θ Theta", alpha: "Α Alpha", beta: "Β Beta", gamma: "Γ Gamma"
};

function classify(bands) {
  const maxKey = Object.keys(bands).reduce((a, b) => bands[a] > bands[b] ? a : b);
  let state, focus, stress, wellbeing, color;
  switch (maxKey) {
    case "gamma": state = "OVERSTIMULATED"; focus = 40; stress = 90; wellbeing = 40; color = "#e74c3c"; break;
    case "beta": state = "FOCUSED"; focus = 85; stress = 60; wellbeing = 75; color = "#00ccff"; break;
    case "alpha": state = "RELAXED"; focus = 70; stress = 30; wellbeing = 95; color = "#2ecc71"; break;
    case "theta": state = "DROWSY"; focus = 40; stress = 25; wellbeing = 60; color = "#f1c40f"; break;
    default: state = "DEEP SLEEP"; focus = 20; stress = 10; wellbeing = 50; color = "#9b59b6";
  }
  return { state, focus, stress, wellbeing, color };
}

// --- Wave canvas ---
const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");
let phase = 0;

function drawWave() {
  if (!ctx) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();

  let amplitude = 10, frequency = 0.05, noiseLevel = 0.2;

  if (seizureMode) { amplitude = 40; frequency = 0.18; noiseLevel = 1.6; }
  else if (stressMode) { amplitude = 22; frequency = 0.09; noiseLevel = 0.6; }
  else if (latestBands) {
    const intensity = Math.max(0, latestBands.gamma || 0);
    amplitude = 10 + Math.min(30, intensity * 5);
    frequency = 0.04 + Math.min(0.2, (latestBands.beta || 0) * 0.01);
    noiseLevel = 0.2 + Math.min(1.2, (latestBands.gamma || 0) * 0.05);
  }

  for (let x = 0; x < w; x++) {
    const noise = (Math.random() - 0.5) * noiseLevel;
    const y = h / 2 + Math.sin((x + phase) * frequency) * amplitude + noise * 10;
    ctx.lineTo(x, y);
  }

  ctx.strokeStyle = seizureMode ? "#e74c3c" : stressMode ? "#f1c40f" : "#00ccff";
  ctx.lineWidth = 1.7;
  ctx.stroke();

  phase += 2;
  if (running) requestAnimationFrame(drawWave);
}

// --- Dashboard + phase logic ---
function updateDashboard() {
  const now = Date.now();
  const elapsed = now - simulationStartTime;
  const bands = latestBands || generateBandEnergies();

  // === automatic time-based phases ===
  if (elapsed >= SEIZURE_START_MS && elapsed < SEIZURE_START_MS + SEIZURE_DURATION_MS) {
    if (!seizureMode) {
      seizureMode = true;
      seizureStartTime = new Date().toLocaleTimeString();
      showAlert("⚡ Gamma Waves Extremely High — Possible Seizure Activity", "rgba(231,76,60,0.95)");
      console.log("⚠️ Seizure started (auto @15s)");
      fetch("https://kskrish20.app.n8n.cloud/webhook/8aa50a17-1f5a-40c3-a938-e21ecabacaf5", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Seizure detected", timestamp: new Date().toISOString(), dominant_wave: "gamma", severity: "high" })
      });
    }
  } else if (elapsed >= SEIZURE_START_MS + SEIZURE_DURATION_MS &&
             elapsed < SEIZURE_START_MS + SEIZURE_DURATION_MS + STRESS_DELAY_AFTER_SEIZURE_MS) {
    if (seizureMode) {
      seizureMode = false;
      seizureStopTime = new Date().toLocaleTimeString();
      hideAlert();
      console.log("✅ Seizure phase ended — cooldown");
    }
  } else if (elapsed >= SEIZURE_START_MS + SEIZURE_DURATION_MS + STRESS_DELAY_AFTER_SEIZURE_MS &&
             elapsed < SEIZURE_START_MS + SEIZURE_DURATION_MS + STRESS_DELAY_AFTER_SEIZURE_MS + STRESS_DURATION_MS) {
    if (!stressMode) {
      stressMode = true;
      stressStartTime = new Date().toLocaleTimeString();
      showAlert("💢 High Beta Waves — Elevated Stress Levels", "rgba(241,196,15,0.95)");
      console.log("⚠️ Stress phase started (auto @45s)");
      fetch("https://kskrish20.app.n8n.cloud/webhook/8aa50a17-1f5a-40c3-a938-e21ecabacaf5", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "High stress levels", timestamp: new Date().toISOString(), dominant_wave: "beta", severity: "medium" })
      });
    }
  } else {
    if (stressMode) {
      stressMode = false;
      stressStopTime = new Date().toLocaleTimeString();
      hideAlert();
      console.log("✅ Stress phase ended — recovery");
    }
  }

  // --- update UI ---
  const { state, focus, stress, wellbeing, color } = classify(bands);
  document.getElementById("state").innerText = seizureMode ? "OVERSTIMULATED" : stressMode ? "FOCUSED" : state;
  document.getElementById("state").style.color = seizureMode ? "#e74c3c" : stressMode ? "#f1c40f" : color;
  document.getElementById("focus").innerText = focus;
  document.getElementById("stress").innerText = stress;
  document.getElementById("wellbeing").innerText = wellbeing;

  const barsContainer = document.getElementById("brainBars");
  if (barsContainer) {
    barsContainer.innerHTML = "";
    Object.entries(bands).forEach(([key, val]) => {
      const barGroup = document.createElement("div");
      barGroup.classList.add("bar-group");
      const bar = document.createElement("div");
      bar.classList.add("bar");
      bar.style.height = Math.min(200, Math.max(20, val * 50)) + "px";
      bar.style.background = color;
      const label = document.createElement("div");
      label.classList.add("bar-label");
      label.textContent = BAR_LABELS[key];
      barGroup.appendChild(bar); barGroup.appendChild(label);
      barsContainer.appendChild(barGroup);
    });
  }

  drawWave();
  console.log("📊 EEG:", bands, "Seizure:", seizureMode, "Stress:", stressMode);
}

// --- Start / Stop ---
function startSimulation() {
  if (running) return;
  running = true;
  simulationStartTime = Date.now();
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
  console.log("🟢 Simulation started");

  mqttClient = mqtt.connect(MQTT_BROKER);
  mqttClient.on("connect", () => {
    console.log("📡 Connected to MQTT");
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
      if (err) console.error("Subscribe error", err);
      else console.log("📥 Subscribed to", MQTT_TOPIC);
    });
  });

  mqttClient.on("message", (topic, message) => {
    try {
      const parsed = JSON.parse(message.toString());
      latestBands = {
        delta: parseFloat(parsed.delta) || 0,
        theta: parseFloat(parsed.theta) || 0,
        alpha: parseFloat(parsed.alpha) || 0,
        beta: parseFloat(parsed.beta) || 0,
        gamma: parseFloat(parsed.gamma) || 0
      };
      console.log("📥 MQTT ->", latestBands);
    } catch (e) { console.warn("Invalid MQTT message:", e); }
  });

  dashboardTimer = setInterval(() => { if (running) updateDashboard(); }, DASHBOARD_INTERVAL_MS);
  drawWave();
}

function stopSimulation() {
  running = false;
  if (dashboardTimer) clearInterval(dashboardTimer);
  if (mqttClient) mqttClient.end(true);
  seizureMode = false; stressMode = false;
  hideAlert();
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
  console.log("🛑 Simulation stopped");

  const resultDiv = document.getElementById("result");
  if (resultDiv) {
    resultDiv.innerHTML = `
      <h3>🧾 Simulation Summary</h3>
      <p>🩸 Seizure: ${seizureStartTime || "—"} → ${seizureStopTime || "—"}</p>
      <p>💢 Stress: ${stressStartTime || "—"} → ${stressStopTime || "—"}</p>`;
  }
}

// --- Wire buttons ---
document.getElementById("startBtn").addEventListener("click", startSimulation);
document.getElementById("stopBtn").addEventListener("click", stopSimulation);
document.getElementById("stopBtn").disabled = true;
drawWave();
