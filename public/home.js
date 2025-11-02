// --- Simulation States ---
let seizureMode = false;
let stressMode = false;
let seizureEndTime = null;
let stressEndTime = null;
let running = false;
let seizureStartTime = null;
let seizureStopTime = null;
let stressStartTime = null;
let stressStopTime = null;
let simulationTimer = null;

// --- Popup alerts ---
const alertPopup = document.createElement("div");
alertPopup.style.position = "fixed";
alertPopup.style.top = "20px";
alertPopup.style.left = "50%";
alertPopup.style.transform = "translateX(-50%)";
alertPopup.style.background = "rgba(231,76,60,0.95)";
alertPopup.style.padding = "15px 30px";
alertPopup.style.borderRadius = "8px";
alertPopup.style.color = "#fff";
alertPopup.style.fontWeight = "600";
alertPopup.style.fontSize = "1rem";
alertPopup.style.letterSpacing = "1px";
alertPopup.style.display = "none";
alertPopup.style.boxShadow = "0 0 20px rgba(231,76,60,0.5)";
alertPopup.style.zIndex = "99999";
document.body.appendChild(alertPopup);

function showAlert(message, color = "rgba(231,76,60,0.95)") {
  alertPopup.style.background = color;
  alertPopup.innerHTML = message;
  alertPopup.style.display = "block";
  alertPopup.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: "forwards" });
}

function hideAlert() {
  alertPopup.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: "forwards" })
    .onfinish = () => (alertPopup.style.display = "none");
}

// --- EEG Band Generator ---
function generateBandEnergies() {
  const bands = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
  Object.keys(bands).forEach(k => bands[k] = Math.random() * 1.2);
  return bands;
}

const BAR_LABELS = {
  delta: "Δ Delta",
  theta: "Θ Theta",
  alpha: "Α Alpha",
  beta: "Β Beta",
  gamma: "Γ Gamma"
};

// --- Classification ---
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

// --- EEG Waveform Canvas ---
const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");
let phase = 0;

function drawWave() {
  if (!ctx) return;
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();

  // Adjust waveform depending on mode
  let amplitude = 10;
  let frequency = 0.05;
  let noiseLevel = 0.2;

  if (seizureMode) {
    amplitude = 35;
    frequency = 0.15;
    noiseLevel = 1.5;
  } else if (stressMode) {
    amplitude = 20;
    frequency = 0.08;
    noiseLevel = 0.5;
  }

  for (let x = 0; x < w; x++) {
    const noise = (Math.random() - 0.5) * noiseLevel;
    const y = h / 2 + Math.sin((x + phase) * frequency) * amplitude + noise;
    ctx.lineTo(x, y);
  }

  ctx.strokeStyle = seizureMode ? "#e74c3c" : stressMode ? "#f1c40f" : "#00ccff";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  phase += 2;
  if (running) requestAnimationFrame(drawWave);
}

// --- EEG & Dashboard update ---
function updateDashboard() {
  const now = Date.now();

  // Handle seizure end
  if (seizureMode && now > seizureEndTime) {
    seizureMode = false;
    hideAlert();
    seizureStopTime = new Date().toLocaleTimeString();
    console.log("✅ Seizure ended");

    // Trigger stress phase after 10s
    setTimeout(() => {
      if (!running) return;
      stressMode = true;
      stressStartTime = new Date().toLocaleTimeString();
      stressEndTime = Date.now() + 20000;
      showAlert(`⚠️ High Beta Waves — Elevated Stress Levels`, "rgba(241,196,15,0.95)");
      console.log("⚠️ Stress phase started");

      fetch("https://kskrish20.app.n8n.cloud/webhook/8aa50a17-1f5a-40c3-a938-e21ecabacaf5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "High stress levels",
          timestamp: new Date().toISOString(),
          dominant_wave: "beta",
          severity: "medium"
        })
      }).then(() => console.log("✅ Stress alert sent"));
    }, 10000);
  }

  // Handle stress end
  if (stressMode && now > stressEndTime) {
    stressMode = false;
    hideAlert();
    stressStopTime = new Date().toLocaleTimeString();
    console.log("✅ Stress phase ended");
  }

  // Define EEG bands
  let bands;
  if (seizureMode) {
    bands = { delta: 0.4, theta: 0.5, alpha: 0.3, beta: 0.6, gamma: 4.0 + Math.random() * 1.0 };
  } else if (stressMode) {
    bands = { delta: 0.3, theta: 0.4, alpha: 0.3, beta: 3.5 + Math.random() * 0.8, gamma: 0.8 };
  } else {
    bands = generateBandEnergies();
  }

  // Update metrics
  const { state, focus, stress, wellbeing, color } = classify(bands);
  document.getElementById("state").innerText = state;
  document.getElementById("state").style.color = color;
  document.getElementById("focus").innerText = focus;
  document.getElementById("stress").innerText = stress;
  document.getElementById("wellbeing").innerText = wellbeing;

  // Update Brain Bars (bottom section)
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

      barGroup.appendChild(bar);
      barGroup.appendChild(label);
      barsContainer.appendChild(barGroup);
    });
  }
}

// --- Start Simulation ---
function startSimulation() {
  if (running) return;
  running = true;
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
  console.log("🟢 Simulation started");

  seizureStartTime = null;
  stressStartTime = null;

  // Trigger seizure after 15s
  setTimeout(() => {
    if (!running) return;
    seizureMode = true;
    seizureStartTime = new Date().toLocaleTimeString();
    seizureEndTime = Date.now() + 20000;
    showAlert(`⚠️ Gamma Waves Extremely High — Possible Seizure Activity`);
    console.log("⚠️ Seizure started");

    fetch("https://kskrish20.app.n8n.cloud/webhook/8aa50a17-1f5a-40c3-a938-e21ecabacaf5", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Seizure detected",
        timestamp: new Date().toISOString(),
        dominant_wave: "gamma",
        severity: "high"
      })
    });
  }, 15000);

  simulationTimer = setInterval(() => {
    if (running) updateDashboard();
  }, 2000);

  drawWave();
}

// --- Stop Simulation ---
function stopSimulation() {
  running = false;
  clearInterval(simulationTimer);
  hideAlert();
  console.log("🛑 Simulation stopped");

  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;

  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <h3>🧾 Simulation Summary</h3>
    <p>🩸 Seizure: ${seizureStartTime || '—'} → ${seizureStopTime || '—'}</p>
    <p>💢 Stress: ${stressStartTime || '—'} → ${stressStopTime || '—'}</p>
  `;
}

// --- Button bindings ---
document.getElementById("startBtn").addEventListener("click", startSimulation);
document.getElementById("stopBtn").addEventListener("click", stopSimulation);

