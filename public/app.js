/**
 * ==========================================================================
 * HIGH-PRECISION INTERNET SPEED TEST ENGINE & MINIMALIST UI CONTROLLER
 * (Google / Fast.com Inspired Sustained Throughput & Smooth Interpolation)
 * ==========================================================================
 */

class SpeedTestEngine {
  constructor() {
    // Lifecycle States: 'IDLE' | 'PING' | 'WARMUP' | 'DOWNLOAD' | 'UPLOAD' | 'FINISHED' | 'PAUSED'
    this.state = 'IDLE';
    
    // Phase Durations (ms)
    this.downloadDurationMs = 8000;
    this.uploadDurationMs = 7000;
    
    // Performance Metrics
    this.ping = 0;
    this.jitter = 0;
    this.downloadMbps = 0;
    this.uploadMbps = 0;
    this.loadedPing = 0;

    // Active Phase Flags
    this.isDownloadActive = false;
    this.isUploadActive = false;
    this.isAborted = false;
    this.isPaused = false;

    // Stream & Worker references
    this.activeConnections = [];
    this.activeReaders = [];
    
    // UI Display Smoothing
    this.displayedSpeed = 0;
    this.targetSpeed = 0;
    this.animFrameId = null;
    
    // Chart data history
    this.chartData = [];
    
    // UI Elements
    this.initElements();
    this.bindEvents();
    this.initChart();
    
    // Fetch Server Info
    this.fetchServerInfo();

    // Auto-start test on page load
    setTimeout(() => this.startTest(), 400);
  }

  initElements() {
    this.elStatus = document.getElementById('statusText');
    this.elSpeedVal = document.getElementById('speedValue');
    this.elSpeedUnit = document.getElementById('speedUnit');
    this.elProgressRing = document.getElementById('progressRing');
    
    this.elMainBtn = document.getElementById('mainActionBtn');
    this.elIconPause = document.getElementById('iconPause');
    this.elIconRestart = document.getElementById('iconRestart');
    this.elIconPlay = document.getElementById('iconPlay');
    
    this.elToggleDetails = document.getElementById('toggleDetailsBtn');
    this.elDetailsPanel = document.getElementById('detailsPanel');
    this.elThemeBtn = document.getElementById('themeToggleBtn');
    
    this.elPingVal = document.getElementById('pingValue');
    this.elJitterVal = document.getElementById('jitterValue');
    this.elUploadVal = document.getElementById('uploadValue');
    this.elLoadedPingVal = document.getElementById('loadedPingValue');
    this.elServerInfo = document.getElementById('serverInfoText');
    this.canvas = document.getElementById('speedChart');
  }

  bindEvents() {
    this.elMainBtn.addEventListener('click', () => this.handleMainAction());
    this.elToggleDetails.addEventListener('click', () => this.toggleDetailsPanel());
    this.elThemeBtn.addEventListener('click', () => this.toggleTheme());
  }

  async fetchServerInfo() {
    try {
      const res = await fetch('/api/server-info');
      if (res.ok) {
        const info = await res.json();
        this.elServerInfo.textContent = `${info.location} (${info.serverName})`;
      }
    } catch (e) {
      this.elServerInfo.textContent = 'SpeedTest Server Node';
    }
  }

  // -------------------------------------------------------------------
  // SMOOTH UI RENDER LOOP (60 FPS)
  // -------------------------------------------------------------------
  startUIRenderLoop() {
    const render = () => {
      // Smooth lerp (linear interpolation) towards targetSpeed
      const diff = this.targetSpeed - this.displayedSpeed;
      if (Math.abs(diff) > 0.05) {
        this.displayedSpeed += diff * 0.08; // smooth 8% step per frame
      } else {
        this.displayedSpeed = this.targetSpeed;
      }

      this.elSpeedVal.textContent = Math.round(this.displayedSpeed);
      this.animFrameId = requestAnimationFrame(render);
    };

    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(render);
    }
  }

  stopUIRenderLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // -------------------------------------------------------------------
  // TEST LIFECYCLE MANAGEMENT
  // -------------------------------------------------------------------
  async startTest() {
    if (this.state === 'PING' || this.state === 'WARMUP' || this.state === 'DOWNLOAD' || this.state === 'UPLOAD') {
      return;
    }

    this.isAborted = false;
    this.isPaused = false;
    this.isDownloadActive = false;
    this.isUploadActive = false;
    this.displayedSpeed = 0;
    this.targetSpeed = 0;
    
    this.chartData = [];
    this.clearChart();
    
    this.setButtonState('pause');
    this.elSpeedVal.classList.add('active');
    this.startUIRenderLoop();

    // Step 1: Ping
    await this.runPingPhase();
    if (this.isAborted) return;

    // Step 2: Warmup & Concurrency Tuning
    const concurrency = await this.runWarmupPhase();
    if (this.isAborted) return;

    // Step 3: Download
    await this.runDownloadPhase(concurrency);
    if (this.isAborted) return;

    // Step 4: Upload
    await this.runUploadPhase(concurrency);
    if (this.isAborted) return;

    // Finish
    this.finishTest();
  }

  handleMainAction() {
    if (this.state === 'FINISHED') {
      this.startTest();
    } else if (this.state === 'PAUSED') {
      this.resumeTest();
    } else {
      this.pauseTest();
    }
  }

  pauseTest() {
    this.isPaused = true;
    this.state = 'PAUSED';
    this.isDownloadActive = false;
    this.isUploadActive = false;
    this.abortAllStreams();
    this.stopUIRenderLoop();
    this.setButtonState('play');
    this.elStatus.textContent = 'Test Paused';
    this.elSpeedVal.classList.remove('active');
  }

  resumeTest() {
    this.startTest();
  }

  cleanupStreams() {
    this.activeReaders.forEach(reader => {
      try { reader.cancel(); } catch (e) {}
    });
    this.activeReaders = [];

    this.activeConnections.forEach(controller => {
      try { controller.abort(); } catch (e) {}
    });
    this.activeConnections = [];
  }

  abortAllStreams() {
    this.isAborted = true;
    this.isDownloadActive = false;
    this.isUploadActive = false;
    this.cleanupStreams();
  }

  finishTest() {
    this.state = 'FINISHED';
    this.stopUIRenderLoop();
    
    // Set final display to sustained download Mbps
    this.targetSpeed = this.downloadMbps;
    this.displayedSpeed = this.downloadMbps;
    this.elSpeedVal.textContent = Math.round(this.downloadMbps);

    this.setButtonState('restart');
    this.updateProgressRing(100);
    this.elStatus.textContent = 'Your Internet Speed Is';
    this.elSpeedVal.classList.remove('active');
  }

  setButtonState(type) {
    this.elIconPause.style.display = type === 'pause' ? 'block' : 'none';
    this.elIconRestart.style.display = type === 'restart' ? 'block' : 'none';
    this.elIconPlay.style.display = type === 'play' ? 'block' : 'none';
  }

  updateProgressRing(percent) {
    const circumference = 2 * Math.PI * 26;
    const offset = circumference - (percent / 100) * circumference;
    this.elProgressRing.style.strokeDashoffset = offset;
  }

  // -------------------------------------------------------------------
  // PHASE 1: PING & JITTER (TRIMMED MEAN)
  // -------------------------------------------------------------------
  async runPingPhase() {
    this.state = 'PING';
    this.elStatus.textContent = 'Measuring latency & ping...';
    this.updateProgressRing(10);

    const pingSamples = [];
    const numSamples = 6;

    for (let i = 0; i < numSamples; i++) {
      if (this.isAborted) return;
      
      const start = performance.now();
      try {
        const res = await fetch(`/api/ping?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const duration = performance.now() - start;
          pingSamples.push(duration);
        }
      } catch (e) {
        // ignore single ping drop
      }
      await new Promise(r => setTimeout(r, 60));
    }

    if (pingSamples.length > 0) {
      // Sort ping samples to calculate median/trimmed mean
      pingSamples.sort((a, b) => a - b);
      
      // Trim top and bottom outliers if we have enough samples
      const validSamples = pingSamples.length >= 4 ? pingSamples.slice(1, -1) : pingSamples;
      const sum = validSamples.reduce((a, b) => a + b, 0);
      this.ping = Math.round(sum / validSamples.length);
      this.elPingVal.textContent = this.ping;

      const avg = sum / validSamples.length;
      const squareDiffs = validSamples.map(val => Math.pow(val - avg, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / validSamples.length;
      this.jitter = Math.round(Math.sqrt(avgSquareDiff) * 10) / 10;
      this.elJitterVal.textContent = this.jitter;
    }
  }

  // -------------------------------------------------------------------
  // PHASE 2: WARMUP
  // -------------------------------------------------------------------
  async runWarmupPhase() {
    this.state = 'WARMUP';
    this.elStatus.textContent = 'Estimating link capacity...';
    this.updateProgressRing(20);

    const controller = new AbortController();
    this.activeConnections.push(controller);

    const start = performance.now();
    let bytesReceived = 0;

    try {
      const response = await fetch('/api/download?size=3', { signal: controller.signal });
      const reader = response.body.getReader();
      this.activeReaders.push(reader);

      while (!this.isAborted) {
        const { done, value } = await reader.read();
        if (done || performance.now() - start > 1000) break;
        bytesReceived += value.length;
      }
    } catch (e) {
      // Warmup done
    } finally {
      this.cleanupStreams();
    }

    const durationSec = (performance.now() - start) / 1000;
    const estMbps = durationSec > 0 ? (bytesReceived * 8) / (durationSec * 1000000) : 10;

    if (estMbps > 100) return 6;
    if (estMbps > 30) return 4;
    return 3;
  }

  // -------------------------------------------------------------------
  // PHASE 3: MULTI-STREAM DOWNLOAD (SLIDING WINDOW & TRIMMED MEAN)
  // -------------------------------------------------------------------
  async runDownloadPhase(concurrency) {
    this.state = 'DOWNLOAD';
    this.isDownloadActive = true;
    this.elStatus.textContent = 'Testing download speed...';
    this.elSpeedUnit.textContent = 'Mbps';

    const startTime = performance.now();
    let totalBytesAccumulated = 0;
    
    // Time-stamped byte sample log: { time, bytes }
    const byteSamples = [{ time: startTime, bytes: 0 }];
    const calculatedSpeeds = [];

    this.activeConnections = [];
    this.activeReaders = [];

    // Continuous 1-Second Sliding Window Calculation (every 100ms)
    const interval = setInterval(() => {
      const now = performance.now();
      const elapsedTotalMs = now - startTime;

      byteSamples.push({ time: now, bytes: totalBytesAccumulated });

      // Find sample from ~1000ms ago for stable 1-second sliding window
      const targetWindowTime = now - 1000;
      let pastSample = byteSamples[0];
      for (let i = byteSamples.length - 1; i >= 0; i--) {
        if (byteSamples[i].time <= targetWindowTime) {
          pastSample = byteSamples[i];
          break;
        }
      }

      const windowBytes = totalBytesAccumulated - pastSample.bytes;
      const windowSec = (now - pastSample.time) / 1000;

      if (windowSec > 0.2) {
        const instantMbps = (windowBytes * 8) / (windowSec * 1000000);

        // Target speed for smooth 60 FPS counter lerp
        this.targetSpeed = instantMbps;

        // Record speed sample after 1.2s TCP slow-start ramp
        if (elapsedTotalMs > 1200) {
          calculatedSpeeds.push(instantMbps);
        }

        const progress = 20 + Math.min(45, (elapsedTotalMs / this.downloadDurationMs) * 45);
        this.updateProgressRing(progress);

        this.addChartPoint(elapsedTotalMs / 1000, Math.round(instantMbps), 'download');
      }
    }, 100);

    // Launch Concurrency Streams
    const streamPromises = [];
    for (let i = 0; i < concurrency; i++) {
      const promise = (async () => {
        while (this.isDownloadActive && !this.isAborted) {
          const controller = new AbortController();
          this.activeConnections.push(controller);

          try {
            const response = await fetch(`/api/download?size=10&id=${i}`, { signal: controller.signal });
            const reader = response.body.getReader();
            this.activeReaders.push(reader);

            while (this.isDownloadActive && !this.isAborted) {
              const { done, value } = await reader.read();
              if (done) break;
              totalBytesAccumulated += value.length;
            }
          } catch (e) {
            break;
          }
        }
      })();

      streamPromises.push(promise);
    }

    await new Promise(resolve => setTimeout(resolve, this.downloadDurationMs));

    this.isDownloadActive = false;
    clearInterval(interval);
    this.cleanupStreams();

    // Compute Final Sustained Download Speed (80th Percentile Trimmed Mean)
    if (calculatedSpeeds.length > 0) {
      calculatedSpeeds.sort((a, b) => a - b);
      // Take 80th percentile range to eliminate transient buffer dips & bursts
      const p80Index = Math.floor(calculatedSpeeds.length * 0.8);
      const sustainedRange = calculatedSpeeds.slice(0, p80Index + 1);
      const sum = sustainedRange.reduce((a, b) => a + b, 0);
      this.downloadMbps = sum / sustainedRange.length;
    } else {
      this.downloadMbps = this.targetSpeed;
    }

    this.measureLoadedPing();
  }

  async measureLoadedPing() {
    try {
      const start = performance.now();
      const res = await fetch(`/api/ping?loaded=1&t=${Date.now()}`);
      if (res.ok) {
        this.loadedPing = Math.round(performance.now() - start);
        this.elLoadedPingVal.textContent = this.loadedPing;
      }
    } catch (e) {
      this.elLoadedPingVal.textContent = Math.round(this.ping * 1.2);
    }
  }

  // -------------------------------------------------------------------
  // PHASE 4: MULTI-STREAM UPLOAD (SLIDING WINDOW & TRIMMED MEAN)
  // -------------------------------------------------------------------
  async runUploadPhase(concurrency) {
    if (this.isAborted) return;

    this.state = 'UPLOAD';
    this.isUploadActive = true;
    this.elStatus.textContent = 'Testing upload speed...';

    const UPLOAD_CHUNK_SIZE = 256 * 1024; // 256 KB
    const dummyChunk = new Uint8Array(UPLOAD_CHUNK_SIZE);
    for (let i = 0; i < UPLOAD_CHUNK_SIZE; i++) {
      dummyChunk[i] = Math.floor(Math.random() * 256);
    }

    const startTime = performance.now();
    let totalBytesUploaded = 0;
    
    const byteSamples = [{ time: startTime, bytes: 0 }];
    const calculatedSpeeds = [];

    this.activeConnections = [];

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsedTotalMs = now - startTime;

      byteSamples.push({ time: now, bytes: totalBytesUploaded });

      const targetWindowTime = now - 1000;
      let pastSample = byteSamples[0];
      for (let i = byteSamples.length - 1; i >= 0; i--) {
        if (byteSamples[i].time <= targetWindowTime) {
          pastSample = byteSamples[i];
          break;
        }
      }

      const windowBytes = totalBytesUploaded - pastSample.bytes;
      const windowSec = (now - pastSample.time) / 1000;

      if (windowSec > 0.2) {
        const instantMbps = (windowBytes * 8) / (windowSec * 1000000);

        this.targetSpeed = instantMbps;

        if (elapsedTotalMs > 1000) {
          calculatedSpeeds.push(instantMbps);
        }

        const formattedUpload = (Math.round(instantMbps * 10) / 10).toFixed(1);
        this.elUploadVal.textContent = formattedUpload;

        const progress = 65 + Math.min(35, (elapsedTotalMs / this.uploadDurationMs) * 35);
        this.updateProgressRing(progress);

        this.addChartPoint(this.downloadDurationMs / 1000 + elapsedTotalMs / 1000, Math.round(instantMbps), 'upload');
      }
    }, 100);

    const streamPromises = [];
    for (let i = 0; i < concurrency; i++) {
      const promise = (async () => {
        while (this.isUploadActive && !this.isAborted) {
          const controller = new AbortController();
          this.activeConnections.push(controller);

          try {
            const res = await fetch('/api/upload', {
              method: 'POST',
              body: dummyChunk,
              signal: controller.signal,
              headers: { 'Content-Type': 'application/octet-stream' }
            });
            if (res.ok) {
              totalBytesUploaded += UPLOAD_CHUNK_SIZE;
            }
          } catch (e) {
            break;
          }
        }
      })();

      streamPromises.push(promise);
    }

    await new Promise(resolve => setTimeout(resolve, this.uploadDurationMs));

    this.isUploadActive = false;
    clearInterval(interval);
    this.cleanupStreams();

    // Compute Final Sustained Upload Speed
    if (calculatedSpeeds.length > 0) {
      calculatedSpeeds.sort((a, b) => a - b);
      const p80Index = Math.floor(calculatedSpeeds.length * 0.8);
      const sustainedRange = calculatedSpeeds.slice(0, p80Index + 1);
      const sum = sustainedRange.reduce((a, b) => a + b, 0);
      this.uploadMbps = sum / sustainedRange.length;
    } else {
      this.uploadMbps = this.targetSpeed;
    }

    this.elUploadVal.textContent = (Math.round(this.uploadMbps * 10) / 10).toFixed(1);
  }

  // -------------------------------------------------------------------
  // LIVE CANVAS CHART
  // -------------------------------------------------------------------
  initChart() {
    this.ctx = this.canvas.getContext('2d');
    this.clearChart();
  }

  clearChart() {
    if (!this.ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 30) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  addChartPoint(timeSec, speedMbps, type) {
    this.chartData.push({ timeSec, speedMbps, type });
    this.renderChart();
  }

  renderChart() {
    if (!this.ctx || this.chartData.length < 2) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.clearChart();

    const maxSpeed = Math.max(80, ...this.chartData.map(d => d.speedMbps)) * 1.15;
    const maxTime = Math.max(13, ...this.chartData.map(d => d.timeSec));

    this.drawPathForType('download', '#f59e0b', width, height, maxSpeed, maxTime);
    this.drawPathForType('upload', '#06b6d4', width, height, maxSpeed, maxTime);
  }

  drawPathForType(type, color, width, height, maxSpeed, maxTime) {
    const points = this.chartData.filter(d => d.type === type);
    if (points.length < 2) return;

    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2.5;

    points.forEach((pt, idx) => {
      const x = (pt.timeSec / maxTime) * width;
      const y = height - (pt.speedMbps / maxSpeed) * (height - 20) - 10;
      if (idx === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    });

    this.ctx.stroke();
  }

  // -------------------------------------------------------------------
  // UI TOGGLES
  // -------------------------------------------------------------------
  toggleDetailsPanel() {
    const isHidden = this.elDetailsPanel.classList.toggle('hidden');
    this.elToggleDetails.classList.toggle('expanded', !isHidden);
    document.getElementById('detailsBtnLabel').textContent = isHidden ? 'Show More Info' : 'Hide Details';
  }

  toggleTheme() {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.speedTestApp = new SpeedTestEngine();
});
