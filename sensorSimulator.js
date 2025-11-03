import mqtt from "mqtt";

const client = mqtt.connect("mqtt://test.mosquitto.org");
const topic = "neuroNexus/eeg"; // make sure frontend uses same topic

// Timings (in ms)
const seizureStart = 15000; // 15s
const seizureEnd = seizureStart + 20000; // 20s seizure
const stressStart = seizureEnd + 10000; // 10s after seizure
const stressEnd = stressStart + 20000; // 20s stress

let startTime = Date.now();

console.log("🧠 EEG Simulator Started — Publishing to MQTT Broker...");
console.log("------------------------------------------------------");

setInterval(() => {
  const elapsed = Date.now() - startTime;
  let eeg = {};
  let phase = "";

  // --- NORMAL PHASE (0–15s)
  if (elapsed < seizureStart) {
    phase = "🟢 NORMAL";
    eeg = {
      delta: (Math.random() * 1.0).toFixed(2),
      theta: (Math.random() * 1.0).toFixed(2),
      alpha: (Math.random() * 1.2).toFixed(2),
      beta: (Math.random() * 1.5).toFixed(2),
      gamma: (Math.random() * 1.0).toFixed(2),
    };
  }

  // --- SEIZURE PHASE (15–35s)
  else if (elapsed >= seizureStart && elapsed < seizureEnd) {
    phase = "⚡ SEIZURE (High Gamma)";
    eeg = {
      delta: (Math.random() * 0.8).toFixed(2),
      theta: (Math.random() * 1.0).toFixed(2),
      alpha: (Math.random() * 0.6).toFixed(2),
      beta: (Math.random() * 2.0).toFixed(2),
      gamma: (5 + Math.random() * 2).toFixed(2), // high gamma
    };
  }

  // --- STRESS PHASE (45–65s)
  else if (elapsed >= stressStart && elapsed < stressEnd) {
    phase = "💢 STRESS (High Beta)";
    eeg = {
      delta: (Math.random() * 0.5).toFixed(2),
      theta: (Math.random() * 0.8).toFixed(2),
      alpha: (Math.random() * 0.7).toFixed(2),
      beta: (4 + Math.random() * 1.5).toFixed(2), // high beta
      gamma: (Math.random() * 0.8).toFixed(2),
    };
  }

  // --- POST-STRESS (after 65s)
  else {
    phase = "🧘‍♂️ RECOVERY";
    eeg = {
      delta: (Math.random() * 0.8).toFixed(2),
      theta: (Math.random() * 0.9).toFixed(2),
      alpha: (1.5 + Math.random() * 0.8).toFixed(2),
      beta: (Math.random() * 0.8).toFixed(2),
      gamma: (Math.random() * 0.6).toFixed(2),
    };
  }

  // Attach timestamp
  eeg.timestamp = new Date().toISOString();

  // Publish to MQTT
  client.publish(topic, JSON.stringify(eeg));

  // Log output
  console.log(`${phase} | EEG:`, eeg);
}, 1000);
console.log("Publishing EEG Data:", JSON.stringify(eeg));
