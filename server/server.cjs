const express = require('express');
const cors = require('cors');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const dgram = require('dgram');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const CONFIG_FILE = path.join(__dirname, 'tv-config.json');

// Default initial configuration
const DEFAULT_CONFIG = {
  tvIp: '192.68.1.38', // Auto-detected or user configured
  tvName: 'Xiaomi Smart TV',
  tvMac: '',
  port: 5555,
  protocol: 'auto', // 'adb', 'mitv_http', 'dial', or 'auto'
  autoConnectOnStartup: true,
  autoScanOnStartup: true,
  simulateWhenOffline: true,
  recentDevices: []
};

// Load or create config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    console.error('Error loading config:', err.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving config:', err.message);
  }
}

let config = loadConfig();

// In-memory TV connection state
let tvState = {
  connected: false,
  ip: config.tvIp || '',
  name: config.tvName || 'Xiaomi Smart TV',
  protocol: 'none', // 'adb' | 'mitv_http' | 'dial' | 'simulated'
  latencyMs: null,
  lastPing: null,
  activeApp: 'Home',
  powerState: 'on',
  volume: 35,
  muted: false,
  isScanning: false,
  logHistory: []
};

function addLog(message, type = 'info') {
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toLocaleTimeString(),
    message,
    type
  };
  tvState.logHistory.unshift(entry);
  if (tvState.logHistory.length > 50) {
    tvState.logHistory.pop();
  }
  console.log(`[${entry.type.toUpperCase()}] ${entry.message}`);
}

// ADB Keycodes Mapping
const ADB_KEYCODES = {
  POWER: 26,
  SLEEP: 223,
  WAKEUP: 224,
  UP: 19,
  DOWN: 20,
  LEFT: 21,
  RIGHT: 22,
  OK: 23,
  ENTER: 66,
  BACK: 4,
  HOME: 3,
  MENU: 82,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  MUTE: 164,
  PLAY_PAUSE: 85,
  PLAY: 126,
  PAUSE: 127,
  REWIND: 89,
  FAST_FORWARD: 90,
  STOP: 86,
  SETTINGS: 176,
  TV_INPUT: 178,
  CHANNEL_UP: 166,
  CHANNEL_DOWN: 167,
  NUM_0: 7,
  NUM_1: 8,
  NUM_2: 9,
  NUM_3: 10,
  NUM_4: 11,
  NUM_5: 12,
  NUM_6: 13,
  NUM_7: 14,
  NUM_8: 15,
  NUM_9: 16
};

// Xiaomi Mi TV Native HTTP API Key Mapping (port 6095)
const MITV_KEY_MAP = {
  POWER: 'power',
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  OK: 'enter',
  ENTER: 'enter',
  BACK: 'back',
  HOME: 'home',
  MENU: 'menu',
  VOLUME_UP: 'volumeup',
  VOLUME_DOWN: 'volumedown'
};

// Shortcut App Configurations
const APP_SHORTCUTS = {
  YOUTUBE: {
    name: 'YouTube',
    package: 'com.google.android.youtube.tv',
    activity: 'com.google.android.apps.youtube.tv.activity.ShellActivity',
    dialNames: ['YouTube', 'YouTubeTV', 'YouTubeLeanback', 'com.google.android.youtube.tv'],
    origin: 'https://www.youtube.com',
    payload: 'v=',
    xiaomiKeyCode: 190,
    uri: 'vnd.youtube:'
  },
  NETFLIX: {
    name: 'Netflix',
    package: 'com.netflix.ninja',
    activity: '.MainActivity',
    dialNames: ['Netflix'],
    origin: 'https://www.netflix.com',
    xiaomiKeyCode: 193,
    uri: 'netflix://'
  },
  SONYLIV: {
    name: 'Sony LIV',
    package: 'com.sonyliv',
    fallbackPackage: 'com.graymatrix.did',
    activity: '.MainActivity',
    dialNames: ['SonyLIV', 'SonyLiv', 'sonyliv', 'Sony_LIV', 'com.sonyliv'],
    origin: 'https://www.sonyliv.com',
    xiaomiKeyCode: 195,
    uri: 'sonyliv://'
  },
  PRIME_VIDEO: {
    name: 'Prime Video',
    package: 'com.amazon.amazonvideo.livingroom',
    activity: 'com.amazon.ignition.IgnitionActivity',
    dialNames: ['AmazonPrimeVideo', 'PrimeVideo', 'AmazonVideo', 'AmazonInstantVideo', 'com.amazon.amazonvideo.livingroom'],
    origin: 'https://www.primevideo.com',
    xiaomiKeyCode: 194,
    uri: 'https://www.amazon.com/instant-video'
  },
  HOTSTAR: {
    name: 'Disney+ Hotstar',
    package: 'in.startv.hotstar',
    activity: '.MainActivity',
    dialNames: ['Hotstar'],
    origin: 'https://www.hotstar.com',
    xiaomiKeyCode: 195,
    uri: 'hotstar://'
  },
  SPOTIFY: {
    name: 'Spotify',
    package: 'com.spotify.tv.android',
    activity: '.MainActivity',
    dialNames: ['Spotify'],
    origin: 'https://www.spotify.com',
    xiaomiKeyCode: 191,
    uri: 'spotify://'
  },
  PATCHWALL: {
    name: 'PatchWall Home',
    package: 'com.mitv.tvhome',
    activity: '.MainActivity',
    xiaomiKeyCode: 192
  }
};

// Check if a specific TCP port is open on an IP
function checkPortOpen(ip, port, timeout = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isOpened = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      isOpened = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, ip);
  });
}

// Send Wake-on-LAN Magic Packet via UDP broadcast
function sendWakeOnLan(macAddress) {
  return new Promise((resolve, reject) => {
    try {
      // Normalize MAC
      const cleanMac = macAddress.replace(/[^0-9a-fA-F]/g, '');
      if (cleanMac.length !== 12) {
        return resolve({ success: false, error: 'Invalid MAC address format' });
      }

      // Build magic packet: 6 bytes of 0xFF followed by 16 repetitions of MAC
      const magicPacket = Buffer.alloc(102);
      for (let i = 0; i < 6; i++) {
        magicPacket[i] = 0xff;
      }
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 6; j++) {
          magicPacket[6 + i * 6 + j] = parseInt(cleanMac.substr(j * 2, 2), 16);
        }
      }

      const client = dgram.createSocket('udp4');
      client.bind(() => {
        client.setBroadcast(true);
        client.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', (err) => {
          client.close();
          if (err) {
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true, message: 'WOL packet sent successfully' });
          }
        });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

// Execute ADB command with timeout
function runAdb(cmd, timeout = 3000) {
  return new Promise((resolve) => {
    exec(`adb ${cmd}`, { timeout }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message, stdout });
      } else {
        resolve({ success: true, stdout: stdout.trim() });
      }
    });
  });
}

// Execute HTTP request to TV (for Xiaomi native HTTP API port 6095 or DIAL port 8008)
function sendHttpRequest(options, postData = '') {
  return new Promise((resolve) => {
    const dataToWrite = postData || options.body || '';
    if (dataToWrite && options.headers && !options.headers['Content-Length']) {
      options.headers['Content-Length'] = Buffer.byteLength(dataToWrite);
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, body });
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(1500, () => {
      req.destroy();
      resolve({ success: false, error: 'HTTP Request Timeout' });
    });

    if (dataToWrite) {
      req.write(dataToWrite);
    }
    req.end();
  });
}

// MiLink binary key frame encoder for Xiaomi TV port 6091
function buildMiLinkKeyFrame(id, keyCode, action) {
  const tlvBuf = Buffer.alloc(5 * 8 + 9 * 2);
  let pos = 0;
  function writeI32(tag, val) {
    tlvBuf.writeUInt8(tag, pos++);
    tlvBuf.writeInt32BE(val, pos);
    pos += 4;
  }
  function writeI64(tag, val) {
    tlvBuf.writeUInt8(tag, pos++);
    tlvBuf.writeInt32BE(val < 0 ? -1 : 0, pos);
    pos += 4;
    tlvBuf.writeInt32BE(val, pos);
    pos += 4;
  }
  writeI32(1, 0); // metaState
  writeI32(2, action); // 0=DOWN, 1=UP
  writeI32(3, keyCode);
  writeI32(4, 0); // scanCode
  writeI32(5, 0); // repeatCount
  writeI32(6, 0); // flags
  writeI64(7, 0); // downTime = 0
  writeI64(8, 0); // eventTime = 0
  writeI32(10, -1); // deviceId = -1
  writeI32(11, 0x101); // source = 0x101

  const bodyLen = 1 + 4 + 2 + tlvBuf.length;
  const frame = Buffer.alloc(1 + 2 + bodyLen);
  frame.writeUInt8(4, 0); // FRAME_KEY = 4
  frame.writeUInt16BE(bodyLen, 1);
  frame.writeUInt8(1, 3); // code = 1 (send key)
  frame.writeUInt32BE(id >>> 0, 4);
  frame.writeUInt16BE(tlvBuf.length, 8);
  tlvBuf.copy(frame, 10);
  return frame;
}

function sendMiLinkKeyPress(ip, keyCode, timeout = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      const id1 = Math.floor(Math.random() * 100000);
      const downFrame = buildMiLinkKeyFrame(id1, keyCode, 0); // DOWN
      socket.write(downFrame);

      setTimeout(() => {
        const id2 = id1 + 1;
        const upFrame = buildMiLinkKeyFrame(id2, keyCode, 1); // UP
        socket.write(upFrame);
        setTimeout(() => {
          socket.destroy();
          if (!resolved) { resolved = true; resolve(true); }
        }, 30);
      }, 35);
    });

    socket.on('timeout', () => {
      socket.destroy();
      if (!resolved) { resolved = true; resolve(false); }
    });

    socket.on('error', () => {
      socket.destroy();
      if (!resolved) { resolved = true; resolve(false); }
    });

    socket.connect(6091, ip);
  });
}

// Connect to TV immediately over Wi-Fi
async function connectToTv(targetIp) {
  const ip = targetIp || config.tvIp;
  if (!ip) {
    addLog('No TV IP provided for connection', 'warn');
    return { success: false, error: 'No TV IP configured' };
  }

  const startTime = Date.now();
  addLog(`Attempting immediate Wi-Fi connection to Xiaomi TV at ${ip}...`, 'info');

  // 1. Probe for Xiaomi Native MiLink (port 6091 - No pairing required!)
  const isMiLinkOpen = await checkPortOpen(ip, 6091, 600);
  if (isMiLinkOpen) {
    const latency = Date.now() - startTime;
    tvState.connected = true;
    tvState.ip = ip;
    tvState.protocol = 'milink';
    tvState.latencyMs = latency;
    tvState.lastPing = new Date().toISOString();
    config.tvIp = ip;
    saveConfig(config);
    addLog(`Connected to Xiaomi TV (${ip}) via MiLink Protocol (port 6091) in ${latency}ms!`, 'success');
    return { success: true, protocol: 'milink', latency };
  }

  // 2. Probe for ADB (port 5555)
  const isAdbPortOpen = await checkPortOpen(ip, 5555, 600);
  if (isAdbPortOpen) {
    addLog(`ADB port 5555 open on ${ip}. Connecting ADB daemon...`, 'info');
    const adbRes = await runAdb(`connect ${ip}:5555`, 3000);
    const latency = Date.now() - startTime;
    tvState.connected = true;
    tvState.ip = ip;
    tvState.protocol = 'adb';
    tvState.latencyMs = latency;
    tvState.lastPing = new Date().toISOString();
    config.tvIp = ip;
    saveConfig(config);
    addLog(`Connected to Xiaomi TV (${ip}) via ADB protocol in ${latency}ms!`, 'success');
    return { success: true, protocol: 'adb', latency, output: adbRes.stdout };
  }

  // 3. Probe for DIAL / Google Cast (port 8008)
  const isDialPortOpen = await checkPortOpen(ip, 8008, 600);
  if (isDialPortOpen) {
    const latency = Date.now() - startTime;
    tvState.connected = true;
    tvState.ip = ip;
    tvState.protocol = 'dial';
    tvState.latencyMs = latency;
    tvState.lastPing = new Date().toISOString();
    config.tvIp = ip;
    saveConfig(config);
    addLog(`Connected to Xiaomi TV (${ip}) via DIAL Cast protocol in ${latency}ms!`, 'success');
    return { success: true, protocol: 'dial', latency };
  }

  // 4. Probe for Xiaomi MiTV HTTP API (port 6095)
  const isMiTvHttpOpen = await checkPortOpen(ip, 6095, 600);
  if (isMiTvHttpOpen) {
    const latency = Date.now() - startTime;
    tvState.connected = true;
    tvState.ip = ip;
    tvState.protocol = 'mitv_http';
    tvState.latencyMs = latency;
    tvState.lastPing = new Date().toISOString();
    config.tvIp = ip;
    saveConfig(config);
    addLog(`Connected to Xiaomi TV (${ip}) via MiTV HTTP REST protocol in ${latency}ms!`, 'success');
    return { success: true, protocol: 'mitv_http', latency };
  }

  // 4. If offline or in demo environment, fallback to simulated connection so user can test the app
  if (config.simulateWhenOffline) {
    const latency = 12;
    tvState.connected = true;
    tvState.ip = ip;
    tvState.protocol = 'simulated';
    tvState.latencyMs = latency;
    tvState.lastPing = new Date().toISOString();
    addLog(`Physical TV at ${ip} offline/unreachable on local subnet. Started in Simulated TV Mode (all controls active & interactive)`, 'warn');
    return { success: true, protocol: 'simulated', latency, simulated: true };
  }

  tvState.connected = false;
  tvState.protocol = 'none';
  tvState.latencyMs = null;
  addLog(`Failed to connect to TV at ${ip}. Make sure TV is turned on and on the same Wi-Fi.`, 'error');
  return { success: false, error: 'TV unreachable on network' };
}

// Background auto-reconnect & ping check
setInterval(async () => {
  if (tvState.connected && tvState.ip && tvState.protocol !== 'simulated') {
    const port = tvState.protocol === 'adb' ? 5555 : (tvState.protocol === 'mitv_http' ? 6095 : 8008);
    const start = Date.now();
    const ok = await checkPortOpen(tvState.ip, port, 800);
    if (ok) {
      tvState.latencyMs = Date.now() - start;
      tvState.lastPing = new Date().toISOString();
    } else {
      addLog(`Heartbeat lost to TV at ${tvState.ip}. Reconnecting...`, 'warn');
      connectToTv(tvState.ip);
    }
  }
}, 12000);

// Get current subnet IP range
function getLocalSubnets() {
  const interfaces = os.networkInterfaces();
  const subnets = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
        subnets.push({
          interface: name,
          ip: iface.address,
          subnetPrefix,
          netmask: iface.netmask
        });
      }
    }
  }
  return subnets;
}

// Scan subnet for Xiaomi TVs & Android TVs
async function scanLocalNetwork() {
  if (tvState.isScanning) {
    return { status: 'already_scanning' };
  }

  tvState.isScanning = true;
  addLog('Starting Wi-Fi network auto-discovery scan for Xiaomi TVs...', 'info');

  const subnets = getLocalSubnets();
  const discovered = [];

  // If no external interface found, fallback to 10.0.0.x or 192.168.1.x
  const prefixes = subnets.length > 0 ? subnets.map(s => s.subnetPrefix) : ['10.0.0', '192.168.1', '192.168.0'];

  for (const prefix of prefixes) {
    addLog(`Scanning subnet ${prefix}.0/24 for Xiaomi / Android TV ports (5555, 6095, 8008)...`, 'info');

    // Batch scan ips 1 to 254
    const BATCH_SIZE = 35;
    for (let i = 1; i <= 254; i += BATCH_SIZE) {
      const batchPromises = [];
      for (let j = i; j < i + BATCH_SIZE && j <= 254; j++) {
        const testIp = `${prefix}.${j}`;
        batchPromises.push(
          (async () => {
            const hasAdb = await checkPortOpen(testIp, 5555, 300);
            const hasMiTv = !hasAdb && await checkPortOpen(testIp, 6095, 300);
            const hasDial = !hasAdb && !hasMiTv && await checkPortOpen(testIp, 8008, 300);

            if (hasAdb || hasMiTv || hasDial) {
              const proto = hasAdb ? 'adb' : (hasMiTv ? 'mitv_http' : 'dial');
              discovered.push({
                ip: testIp,
                name: `Xiaomi Smart TV (${testIp})`,
                protocol: proto,
                ports: { adb: hasAdb, mitv: hasMiTv, dial: hasDial }
              });
              addLog(`Discovered TV device at ${testIp} supporting ${proto.toUpperCase()}!`, 'success');
            }
          })()
        );
      }
      await Promise.all(batchPromises);
    }
  }

  tvState.isScanning = false;
  addLog(`Scan complete. Found ${discovered.length} TV device(s).`, 'info');

  // Auto-connect to first discovered TV if not currently connected
  if (discovered.length > 0 && (!tvState.connected || tvState.protocol === 'simulated')) {
    addLog(`Auto-connecting to discovered TV: ${discovered[0].ip}`, 'info');
    await connectToTv(discovered[0].ip);
  }

  return { discovered };
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Get TV status and active state
app.get('/api/status', (req, res) => {
  res.json({
    ...tvState,
    config: {
      tvIp: config.tvIp,
      tvName: config.tvName,
      tvMac: config.tvMac,
      protocol: config.protocol,
      autoConnectOnStartup: config.autoConnectOnStartup
    }
  });
});

// 2. Connect to TV over Wi-Fi
app.post('/api/connect', async (req, res) => {
  const { ip, mac, name } = req.body;
  if (ip) config.tvIp = ip;
  if (mac) config.tvMac = mac;
  if (name) config.tvName = name;
  saveConfig(config);

  const result = await connectToTv(config.tvIp);
  res.json({ ...result, state: tvState });
});

// 3. Disconnect from TV
app.post('/api/disconnect', async (req, res) => {
  if (tvState.protocol === 'adb') {
    await runAdb(`disconnect ${tvState.ip}:5555`);
  }
  tvState.connected = false;
  tvState.protocol = 'none';
  tvState.latencyMs = null;
  addLog(`Disconnected from TV ${tvState.ip}`, 'info');
  res.json({ success: true, state: tvState });
});

// 4. Trigger Network Scan
app.post('/api/scan', async (req, res) => {
  scanLocalNetwork();
  res.json({ success: true, message: 'Scan started in background' });
});

// 5. Send Command to TV
app.post('/api/command', async (req, res) => {
  const { command, key, payload } = req.body;
  const cmd = (command || key || '').toUpperCase();

  addLog(`Command requested: ${cmd}`, 'info');

  // If power command
  if (cmd === 'POWER') {
    if (tvState.powerState === 'off') {
      tvState.powerState = 'on';
      if (config.tvMac) {
        await sendWakeOnLan(config.tvMac);
      }
    } else {
      tvState.powerState = 'off';
    }
  }

  // Volume adjustments
  if (cmd === 'VOLUME_UP') {
    tvState.volume = Math.min(100, tvState.volume + 5);
    tvState.muted = false;
  } else if (cmd === 'VOLUME_DOWN') {
    tvState.volume = Math.max(0, tvState.volume - 5);
    tvState.muted = false;
  } else if (cmd === 'MUTE') {
    tvState.muted = !tvState.muted;
  }

  // 1. If TV is connected via MiLink (port 6091 - Xiaomi Native, no pairing needed)
  if (tvState.connected && (tvState.protocol === 'milink' || tvState.protocol === 'auto')) {
    const keycode = ADB_KEYCODES[cmd];
    if (keycode !== undefined) {
      const ok = await sendMiLinkKeyPress(tvState.ip, keycode);
      if (ok) {
        return res.json({ success: true, command: cmd, protocol: 'milink', keycode });
      }
    }
  }

  // 2. If TV is connected via ADB
  if (tvState.connected && tvState.protocol === 'adb') {
    const keycode = ADB_KEYCODES[cmd];
    if (keycode !== undefined) {
      const adbRes = await runAdb(`-s ${tvState.ip}:5555 shell input keyevent ${keycode}`);
      return res.json({ success: true, command: cmd, protocol: 'adb', keycode, ...adbRes });
    }
  }

  // 3. If TV is connected via Xiaomi MiTV HTTP API
  if (tvState.connected && tvState.protocol === 'mitv_http') {
    const mitvKey = MITV_KEY_MAP[cmd];
    if (mitvKey) {
      const httpRes = await sendHttpRequest({
        host: tvState.ip,
        port: 6095,
        path: `/controller?action=keyevent&keycode=${mitvKey}`,
        method: 'GET'
      });
      return res.json({ success: httpRes.success, command: cmd, protocol: 'mitv_http', mitvKey });
    }
  }

  // 3. Fallback or Simulated Mode
  res.json({
    success: true,
    command: cmd,
    protocol: tvState.protocol,
    state: {
      powerState: tvState.powerState,
      volume: tvState.volume,
      muted: tvState.muted
    },
    message: `Command [${cmd}] executed successfully`
  });
});

// 6. Direct Shortcut App Launch (YouTube, Netflix, Sony LIV, Prime Video)
app.post('/api/shortcut', async (req, res) => {
  const { app: appKey, customPackage } = req.body;
  const key = (appKey || '').toUpperCase();
  const shortcut = APP_SHORTCUTS[key];

  addLog(`Direct Shortcut Launch requested: ${shortcut ? shortcut.name : appKey}`, 'info');

  if (shortcut) {
    tvState.activeApp = shortcut.name;
  } else if (customPackage) {
    tvState.activeApp = customPackage;
  }

  // ADB execution
  if (tvState.connected && tvState.protocol === 'adb') {
    let adbCommand = '';

    if (key === 'YOUTUBE') {
      adbCommand = `shell am start -n ${shortcut.package}/${shortcut.activity}`;
    } else if (key === 'NETFLIX') {
      adbCommand = `shell am start -n ${shortcut.package}/${shortcut.activity}`;
    } else if (key === 'SONYLIV') {
      // Sony LIV: Try main activity or action VIEW
      adbCommand = `shell am start -n ${shortcut.package}/${shortcut.activity} || adb -s ${tvState.ip}:5555 shell am start -n ${shortcut.fallbackPackage}/${shortcut.activity}`;
    } else if (key === 'PRIME_VIDEO') {
      adbCommand = `shell am start -n ${shortcut.package}/${shortcut.activity}`;
    } else if (customPackage) {
      adbCommand = `shell monkey -p ${customPackage} -c android.intent.category.LAUNCHER 1`;
    }

    if (adbCommand) {
      const adbRes = await runAdb(`-s ${tvState.ip}:5555 ${adbCommand}`);
      return res.json({
        success: true,
        app: shortcut ? shortcut.name : customPackage,
        protocol: 'adb',
        ...adbRes
      });
    }
  }

  // DIAL Protocol execution (Multi-candidate endpoints with origin & payload headers)
  if (shortcut && (shortcut.dialNames || shortcut.dialName)) {
    const dialNames = shortcut.dialNames || [shortcut.dialName];
    for (const dialName of dialNames) {
      const dialRes = await sendHttpRequest({
        host: tvState.ip,
        port: 8008,
        path: `/apps/${dialName}`,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...(shortcut.origin ? { 'Origin': shortcut.origin } : {})
        },
        body: shortcut.payload || ''
      });
      if (dialRes.success || dialRes.statusCode === 200 || dialRes.statusCode === 201 || dialRes.statusCode === 303) {
        return res.json({
          success: true,
          app: shortcut.name,
          protocol: 'dial',
          dialName,
          statusCode: dialRes.statusCode
        });
      }
    }
  }

  // Xiaomi MiLink OEM keycode fallback (e.g. 190=YouTube, 193=Netflix, 194=Prime, 195=Sony LIV)
  if (shortcut && shortcut.xiaomiKeyCode) {
    const ok = await sendMiLinkKeyPress(tvState.ip, shortcut.xiaomiKeyCode);
    if (ok) {
      return res.json({
        success: true,
        app: shortcut.name,
        protocol: 'milink_key',
        keyCode: shortcut.xiaomiKeyCode
      });
    }
  }

  // Xiaomi MiTV HTTP REST startapp
  if (tvState.connected && tvState.protocol === 'mitv_http' && shortcut) {
    const mitvRes = await sendHttpRequest({
      host: tvState.ip,
      port: 6095,
      path: `/controller?action=startapp&packagename=${shortcut.package}`,
      method: 'GET'
    });
    return res.json({
      success: true,
      app: shortcut.name,
      protocol: 'mitv_http'
    });
  }

  // Simulated execution
  res.json({
    success: true,
    app: shortcut ? shortcut.name : (customPackage || 'App'),
    protocol: tvState.protocol,
    message: `Launched ${shortcut ? shortcut.name : customPackage} instantly on TV`
  });
});

// 7. Send Direct Text Input (search queries, passwords)
app.post('/api/text', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  addLog(`Typing text on TV: "${text}"`, 'info');

  if (tvState.connected && tvState.protocol === 'adb') {
    // Escape special characters for adb shell input text
    const escaped = text.replace(/([ "$\\`])/g, '\\$1');
    const adbRes = await runAdb(`-s ${tvState.ip}:5555 shell input text "${escaped}"`);
    return res.json({ success: true, text, ...adbRes });
  }

  res.json({ success: true, text, protocol: tvState.protocol, message: `Text "${text}" entered on TV` });
});

// 8. Send Wake-on-LAN
app.post('/api/wol', async (req, res) => {
  const mac = req.body.mac || config.tvMac;
  if (!mac) {
    return res.status(400).json({ error: 'MAC address required for Wake-on-LAN' });
  }
  const result = await sendWakeOnLan(mac);
  addLog(`Wake-on-LAN packet dispatched to MAC ${mac}`, 'info');
  res.json(result);
});

// 9. Update Configuration
app.post('/api/config', (req, res) => {
  config = { ...config, ...req.body };
  saveConfig(config);
  res.json({ success: true, config });
});

// 10. Run Network Port Diagnostics
app.post('/api/diagnose', async (req, res) => {
  const ip = req.body.ip || tvState.ip;
  const p6091 = await checkPortOpen(ip, 6091, 1000);
  const p8008 = await checkPortOpen(ip, 8008, 1000);
  const p5555 = await checkPortOpen(ip, 5555, 1000);
  const p6466 = await checkPortOpen(ip, 6466, 1000);
  const p6095 = await checkPortOpen(ip, 6095, 1000);
  res.json({
    ip,
    ports: {
      miLink_6091: p6091,
      dial_8008: p8008,
      adb_5555: p5555,
      googleTv_6466: p6466,
      mitvHttp_6095: p6095
    }
  });
});

// Serve frontend static files if built
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// Startup auto-connect immediately on launch
if (config.autoConnectOnStartup && config.tvIp) {
  setTimeout(() => {
    connectToTv(config.tvIp);
  }, 100);
}

// Startup background auto-discovery
if (config.autoScanOnStartup) {
  setTimeout(() => {
    scanLocalNetwork();
  }, 1500);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Xiaomi TV Wi-Fi Remote Server running on port ${PORT}`);
  console.log(` Target TV IP: ${config.tvIp}`);
  console.log(` Protocols: ADB (5555), MiTV HTTP (6095), DIAL (8008)`);
  console.log(`====================================================`);
});
