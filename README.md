# Internet Speed Test

An internet speed test web application built with Node.js and JavaScript. Measures download speed, upload speed, latency (ping), and jitter using multi-connection streaming.

## Features

* Minimalist UI inspired by Fast.com
* Multi-connection parallel download and upload testing
* In-memory byte streaming to prevent disk I/O bottlenecks
* Real-time Mbps speed counter and live waveform graph
* Measures Ping, Jitter, and Loaded Ping under network load
* Low browser memory usage during tests

## Requirements

* Node.js (v14 or higher)
* npm

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/ankushlunia/Internet_speed_test.git
   cd Internet_speed_test
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3005`.

## API Endpoints

* `GET /api/ping` - Returns server timestamp for measuring latency and round-trip time.
* `GET /api/download?size=MB` - Streams pseudo-random binary data chunks for download speed measurement.
* `POST /api/upload` - Receives uploaded data chunks and discards them while tracking total bytes.
* `GET /api/server-info` - Returns server details and location metadata.

## License

MIT
