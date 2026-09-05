const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3005;

// Enable CORS for all routes
app.use(cors());

// Serve static assets from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Pre-allocate a 1 MB pseudo-random buffer in RAM once for streaming download test
// Filling with pseudo-random bytes prevents gzip/deflate compression from distorting transfer speed math
const CHUNK_SIZE = 1024 * 1024; // 1 MB
const SAMPLE_BUFFER = Buffer.alloc(CHUNK_SIZE);
for (let i = 0; i < CHUNK_SIZE; i++) {
  SAMPLE_BUFFER[i] = Math.floor(Math.random() * 256);
}

// -------------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------------

// 1. PING & LATENCY ENDPOINT
app.get('/api/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({
    status: 'ok',
    serverTime: Date.now(),
    clientIp: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
  });
});

// 2. DYNAMIC STREAMING DOWNLOAD ENDPOINT
app.get('/api/download', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename=speedtest.bin');

  // Size in MB requested by client, default to 25 MB per stream
  const requestedMb = parseFloat(req.query.size) || 25;
  const totalBytesToSend = Math.round(requestedMb * 1024 * 1024);
  res.setHeader('Content-Length', totalBytesToSend);

  let bytesSent = 0;

  function streamChunks() {
    let canContinue = true;
    while (bytesSent < totalBytesToSend && canContinue) {
      const remainingBytes = totalBytesToSend - bytesSent;
      const currentChunkSize = Math.min(CHUNK_SIZE, remainingBytes);
      const chunk = (currentChunkSize === CHUNK_SIZE) ? SAMPLE_BUFFER : SAMPLE_BUFFER.subarray(0, currentChunkSize);

      bytesSent += chunk.length;
      canContinue = res.write(chunk);
    }

    if (bytesSent < totalBytesToSend) {
      // Handle backpressure if res buffer is full
      res.once('drain', streamChunks);
    } else {
      res.end();
    }
  }

  // Handle client disconnection mid-download cleanly
  req.on('close', () => {
    res.end();
  });

  streamChunks();
});

// 3. STREAM SINK UPLOAD ENDPOINT
app.post('/api/upload', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  let totalBytesReceived = 0;
  const startTime = Date.now();

  req.on('data', (chunk) => {
    totalBytesReceived += chunk.length;
  });

  req.on('end', () => {
    const duration = (Date.now() - startTime) / 1000;
    res.json({
      status: 'ok',
      bytesReceived: totalBytesReceived,
      durationSeconds: duration,
      calculatedMbps: duration > 0 ? (totalBytesReceived * 8) / (duration * 1000000) : 0
    });
  });

  req.on('error', (err) => {
    console.error('Upload stream error:', err);
    res.status(500).json({ error: 'Upload stream failed' });
  });
});

// 4. SERVER METADATA ENDPOINT
app.get('/api/server-info', (req, res) => {
  res.json({
    serverName: 'Local Cloud VM Node',
    location: 'Mumbai / India (Primary)',
    nodeVersion: process.version,
    platform: `${os.type()} ${os.release()}`,
    cpuCores: os.cpus().length,
    freeMemoryMb: Math.round(os.freemem() / (1024 * 1024))
  });
});

// Start server listening on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ SpeedTest Server active at http://localhost:${PORT}`);
});
