# ⚡ Internet Speed Test App

A high-precision internet speed testing web application inspired by Fast.com and Ookla Speedtest. Built with a Node.js dynamic streaming backend and an ultra-minimalist frontend UI focused on displaying speed prominently.

![Speed Test Preview](https://img.shields.io/badge/SpeedTest-Mbps-f59e0b?style=for-the-badge)

## 🚀 Features

* **Ultra-Minimal UI**: Clean, Fast.com inspired hero interface centered on a bold live speed counter.
* **Streaming Backend Engine**: Dynamic pseudo-random memory streams over HTTP/1.1 & HTTP/2 (`/api/download`, `/api/upload`, `/api/ping`) with zero disk I/O bottlenecks.
* **Low-Overhead Ping & Jitter**: Computes real-time RTT latency and jitter variance using multi-sample ping probes.
* **Adaptive Multi-Stream Concurrency**: Automatically tunes stream count (4–8 parallel TCP streams) based on link capacity.
* **Ultra-Low Memory Footprint**: Upload engine re-uses a single 1 MB array buffer in browser RAM, ensuring zero memory bloat even during gigabit transfer tests.
* **Expandable Stats Panel**: Toggle details for Latency, Jitter, Upload speed, Loaded Ping, Server info, and a real-time speed waveform canvas graph.
* **Light / Dark Theme Support**: Smooth theme switching with sleek glassmorphism aesthetic.

---

## 🛠️ Technology Stack

* **Backend**: Node.js, Express, CORS
* **Frontend**: HTML5, Vanilla CSS3 (CSS Variables, Flexbox/Grid, Animations), JavaScript ES6+ (Fetch API, ReadableStream)

---

## ⚡ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/ankushlunia/speedtest-app.git
cd speedtest-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Application
```bash
npm start
```

Open `http://localhost:3005` in your browser to run the speed test!

---

## 📁 Project Structure

```
speedtest-app/
├── package.json         # Node.js dependencies and scripts
├── server.js            # Express backend with streaming APIs
├── README.md            # Project documentation
├── .gitignore           # Git ignore rules
└── public/
    ├── index.html       # Minimalist UI shell
    ├── style.css        # Glassmorphic design & typography
    └── app.js           # Speed test calculation engine
```

---

## 📜 License

MIT License © 2026 Ankush Lunia
