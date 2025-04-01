const express = require('express');
const cors = require('cors');
const { networkInterfaces } = require('os');
const WebSocket = require('ws');
const { execSync } = require('child_process');

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// WebSocket setup
const wss = new WebSocket.Server({ noServer: true });

// Enhanced network scanning
const scanNetwork = () => {
  const devices = [];
  const nets = networkInterfaces();
  
  // Get local network devices
  Object.entries(nets).forEach(([name, iface]) => {
    iface.forEach((net) => {
      if (net.family === 'IPv4' && !net.internal) {
        // Get actual MAC address
        let mac = '00:00:00:00:00:00';
        try {
          const arpOutput = execSync(`arp -a ${net.address}`).toString();
          const macMatch = arpOutput.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
          if (macMatch) mac = macMatch[0];
        } catch (e) {}

        // Ping check for status
        let status = 'offline';
        try {
          execSync(`ping -c 1 ${net.address}`, {stdio: 'ignore'});
          status = 'online';
        } catch (e) {}

        // OS detection
        let os = 'unknown';
        if (name.includes('eth') || name.includes('en')) os = 'linux';
        if (name.includes('wi-fi') || name.includes('wireless')) os = 'windows';

        devices.push({
          name: name,
          ip: net.address,
          mac: mac,
          status: status,
          os: os
        });
      }
    });
  });

  return devices;
};

// Network scanning endpoint
app.get('/api/devices', (req, res) => {
  res.json(scanNetwork());
});

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// WebSocket connections
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  // Send periodic updates
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'heartbeat', time: Date.now() }));
  }, 5000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});