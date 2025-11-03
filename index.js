const express = require("express");
const app = express();
const path = require("path");
const mqtt = require("mqtt");
const { fft } = require("fft-js");
const http = require("http");
const { Server } = require("socket.io");

// Express setup
const server = http.createServer(app);
const io = new Server(server);
const port = 5000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");

// ROUTES
app.get("/", (req, res) => res.render("home.ejs"));
app.get("/about", (req, res) => res.render("about.ejs"));

// ---------------------
// 🧠 EEG MQTT + FFT LOGIC
// ---------------------

const MQTT_BROKER = "mqtt://broker.hivemq.com";
const TOPIC = "eeg/data";

const client = mqtt.connect(MQTT_BROKER);
let eegBuffer = [];
const SAMPLE_SIZE = 512; // number of samples per FFT window

client.on("connect", () => {
  console.log(`📡 Connected to MQTT broker: ${MQTT_BROKER}`);
  client.subscribe(TOPIC, () => console.log(`📥 Subscribed to topic: ${TOPIC}`));
});

client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const value = parseFloat(data.channel1);
    eegBuffer.push(value);

    if (eegBuffer.length >= SAMPLE_SIZE) {
      // Perform FFT
      const phasors = fft(eegBuffer);
      const magnitudes = phasors.map((c) => Math.sqrt(c[0] ** 2 + c[1] ** 2));

      // Band power calculation
      const sampleRate = 250; // Hz
      const freqs = magnitudes.map((_, i) => (i * sampleRate) / SAMPLE_SIZE);

      const bands = { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
      freqs.forEach((f, i) => {
        const mag = magnitudes[i];
        if (f >= 0.5 && f < 4) bands.delta += mag;
        else if (f >= 4 && f < 8) bands.theta += mag;
        else if (f >= 8 && f < 13) bands.alpha += mag;
        else if (f >= 13 && f < 30) bands.beta += mag;
        else if (f >= 30 && f < 100) bands.gamma += mag;
      });

      // Normalize
      const total = Object.values(bands).reduce((a, b) => a + b, 0);
      for (const key in bands) bands[key] = (bands[key] / total).toFixed(2);

      console.log("📊 EEG Bands:", bands);

      // Emit to frontend via Socket.IO
      io.emit("eegUpdate", bands);

      eegBuffer = []; // clear buffer for next window
    }
  } catch (err) {
    console.error("❌ MQTT Parse Error:", err);
  }
});

// ---------------------
// 🔌 Socket.IO connection
// ---------------------
io.on("connection", (socket) => {
  console.log("🧠 Frontend connected to EEG stream");
});

// ---------------------
server.listen(port, () => {
  console.log(`🧠 Neuro-Alert running on http://localhost:${port}`);
});
