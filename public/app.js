/**
 * ==========================================================================
 * HIGH-PRECISION INTERNET SPEED TEST ENGINE & MINIMALIST UI CONTROLLER
 * ==========================================================================
 */

class SpeedTestEngine {
  constructor() {
    // Lifecycle States: 'IDLE' | 'PING' | 'WARMUP' | 'DOWNLOAD' | 'UPLOAD' | 'FINISHED' | 'PAUSED'
    this.state = 'IDLE';
    
    // Test Durations (ms)
    this.downloadDurationMs = 7000;
    this.uploadDurationMs = 6000;
    
    // Performance Metrics
    this.ping = 0;
    this.jitter = 0;
    this.downloadMbps = 0;
    this.uploadMbps = 0;
    this.loadedPing = 0;

    // Real-time tracking vars
    this.activeConnections = [];
    this.activeReaders = [];
    this.isAborted = false;
    this.isPaused = false;
    
    // Chart history
    this.chartData = [];
    
    // UI Elements
    this.initElements();
    this.bindEvents();
    this.initChart();
    
    // Fetch Server Metadata
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

  // -------------------------------------------------------------------
  // SERVER METADATA
  // -------------------------------------------------------------------
  async fetchServerInfo() {
    try {
      const res = await fetch('/api/server-info');
      if (res.ok) {
        const info = await res.json();
        this.elServerInfo.textContent = `${info.location} (${info.serverName})`;
      }
    } catch (e) {
      this.elServerInfo.textContent = 'Local Server';
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
    this.chartData = [];
    this.clearChart();
    
    this.setButtonState('pause');
    this.elSpeedVal.classList.add('active');

    // Step 1: Latency & Jitter
    await this.runPingPhase();
    if (this.isAborted) return;

    // Step 2: Warmup & Concurrency Tuning
    const concurrency = await this.runWarmupPhase();
    if (this.isAborted) return;

    // Step 3: Multi-Connection Download Phase
    await this.runDownloadPhase(concurrency);
    if (this.isAborted) return;

    // Step 4: Multi-Connection Upload Phase
    await this.runUploadPhase(concurrency);
    if (this.isAborted) return;

    // Finish Test
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
    this.abortAllStreams();
    this.setButtonState('play');
    this.elStatus.textContent = 'Test Paused';
    this.elSpeedVal.classList.remove('active');
  }

  resumeTest() {
    this.startTest();
  }

  // Clean up network connections without marking the overall test aborted
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

  // User-initiated or hard abort
  abortAllStreams() {
    this.isAborted = true;
    this.cleanupStreams();
  }

  finishTest() {
    this.state = 'FINISHED';
    this.setButtonState('restart');
    this.updateProgressRing(100);
    this.elStatus.textContent = 'Your Internet Speed Is';
    this.elSpeedVal.textContent = Math.round(this.downloadMbps);
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
  // PHASE 1: LATENCY & JITTER
  // -------------------------------------------------------------------
  async runPingPhase() {
    this.state = 'PING';
    this.elStatus.textContent = 'Measuring latency & ping...';
    this.updateProgressRing(10);

    const pingSamples = [];
    const numSamples = 5;

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
        // ignore sample drop
      }
      await new Promise(r => setTimeout(r, 60));
    }

    if (pingSamples.length > 0) {
      const sum = pingSamples.reduce((a, b) => a + b, 0);
      this.ping = Math.round(sum / pingSamples.length);
      this.elPingVal.textContent = this.ping;

      const avg = sum / pingSamples.length;
      const squareDiffs = pingSamples.map(val => Math.pow(val - avg, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / pingSamples.length;
      this.jitter = Math.round(Math.sqrt(avgSquareDiff) * 10) / 10;
      this.elJitterVal.textContent = this.jitter;
    }
  }

  // -------------------------------------------------------------------
  // PHASE 2: WARMUP & ADAPTIVE TUNING
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

    if (estMbps > 120) return 6;
    if (estMbps > 30) return 4;
    return 3;
  }

  // -------------------------------------------------------------------
  // PHASE 3: MULTI-STREAM DOWNLOAD
  // -------------------------------------------------------------------
  async runDownloadPhase(concurrency) {
    this.state = 'DOWNLOAD';
    this.elStatus.textContent = 'Testing download speed...';
    this.elSpeedUnit.textContent = 'Mbps';

    const startTime = performance.now();
    let bytesInWindow = 0;
    let lastWindowTime = startTime;
    let smoothedSpeed = 0;

    this.activeConnections = [];
    this.activeReaders = [];

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsedTotalMs = now - startTime;
      const elapsedWindowSec = (now - lastWindowTime) / 1000;

      if (elapsedWindowSec > 0.05) {
        const instantMbps = (bytesInWindow * 8) / (elapsedWindowSec * 1000000);
        bytesInWindow = 0;
        lastWindowTime = now;

        smoothedSpeed = smoothedSpeed === 0 ? instantMbps : smoothedSpeed * 0.7 + instantMbps * 0.3;
        
        this.downloadMbps = smoothedSpeed;
        this.elSpeedVal.textContent = Math.round(smoothedSpeed);

        const progress = 20 + Math.min(45, (elapsedTotalMs / this.downloadDurationMs) * 45);
        this.updateProgressRing(progress);

        this.addChartPoint(elapsedTotalMs / 1000, Math.round(smoothedSpeed), 'download');
      }
    }, 50);

    const streamPromises = [];
    for (let i = 0; i < concurrency; i++) {
      const promise = (async () => {
        while (!this.isAborted) {
          const controller = new AbortController();
          this.activeConnections.push(controller);

          try {
            const response = await fetch(`/api/download?size=8&id=${i}`, { signal: controller.signal });
            const reader = response.body.getReader();
            this.activeReaders.push(reader);

            while (!this.isAborted) {
              const { done, value } = await reader.read();
              if (done) break;
              bytesInWindow += value.length;
            }
          } catch (e) {
            break;
          }
        }
      })();

      streamPromises.push(promise);
    }

    const timeoutPromise = new Promise(resolve => setTimeout(resolve, this.downloadDurationMs));
    await Promise.race([Promise.all(streamPromises), timeoutPromise]);

    clearInterval(interval);
    this.cleanupStreams();

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
      this.elLoadedPingVal.textContent = Math.round(this.ping * 1.25);
    }
  }

  // -------------------------------------------------------------------
  // PHASE 4: MULTI-STREAM UPLOAD
  // -------------------------------------------------------------------
  async runUploadPhase(concurrency) {
    if (this.isAborted) return;

    this.state = 'UPLOAD';
    this.elStatus.textContent = 'Testing upload speed...';

    const UPLOAD_CHUNK_SIZE = 1024 * 1024;
    const dummyChunk = new Uint8Array(UPLOAD_CHUNK_SIZE);
    for (let i = 0; i < UPLOAD_CHUNK_SIZE; i++) {
      dummyChunk[i] = Math.floor(Math.random() * 256);
    }

    const startTime = performance.now();
    let bytesInWindow = 0;
    let lastWindowTime = startTime;
    let smoothedSpeed = 0;

    this.activeConnections = [];

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsedTotalMs = now - startTime;
      const elapsedWindowSec = (now - lastWindowTime) / 1000;

      if (elapsedWindowSec > 0.05) {
        const instantMbps = (bytesInWindow * 8) / (elapsedWindowSec * 1000000);
        bytesInWindow = 0;
        lastWindowTime = now;

        smoothedSpeed = smoothedSpeed === 0 ? instantMbps : smoothedSpeed * 0.7 + instantMbps * 0.3;

        this.uploadMbps = smoothedSpeed;
        this.elUploadVal.textContent = (Math.round(smoothedSpeed * 10) / 10).toFixed(1);

        const progress = 65 + Math.min(35, (elapsedTotalMs / this.uploadDurationMs) * 35);
        this.updateProgressRing(progress);

        this.addChartPoint(this.downloadDurationMs / 1000 + elapsedTotalMs / 1000, Math.round(smoothedSpeed), 'upload');
      }
    }, 50);

    const streamPromises = [];
    for (let i = 0; i < concurrency; i++) {
      const promise = (async () => {
        while (!this.isAborted) {
          const controller = new AbortController();
          this.activeConnections.push(controller);

          try {
            await fetch('/api/upload', {
              method: 'POST',
              body: dummyChunk,
              signal: controller.signal,
              headers: { 'Content-Type': 'application/octet-stream' }
            });
            bytesInWindow += UPLOAD_CHUNK_SIZE;
          } catch (e) {
            break;
          }
        }
      })();

      streamPromises.push(promise);
    }

    const timeoutPromise = new Promise(resolve => setTimeout(resolve, this.uploadDurationMs));
    await Promise.race([Promise.all(streamPromises), timeoutPromise]);

    clearInterval(interval);
    this.cleanupStreams();
  }

  // -------------------------------------------------------------------
  // LIVE CANVAS SPEED WAVEFORM CHART
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

// Instantiate engine when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.speedTestApp = new SpeedTestEngine();
});
