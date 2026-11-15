// TV Remote API Service

export interface TVState {
  connected: boolean;
  ip: string;
  name: string;
  protocol: 'adb' | 'mitv_http' | 'dial' | 'simulated' | 'none';
  latencyMs: number | null;
  lastPing: string | null;
  activeApp: string;
  powerState: 'on' | 'off';
  volume: number;
  muted: boolean;
  isScanning: boolean;
  logHistory: Array<{
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warn' | 'error';
  }>;
  config?: {
    tvIp: string;
    tvName: string;
    tvMac?: string;
    protocol: string;
    autoConnectOnStartup: boolean;
  };
}

export interface DiscoveredDevice {
  ip: string;
  name: string;
  protocol: string;
  ports: {
    adb: boolean;
    mitv: boolean;
    dial: boolean;
  };
}

const API_BASE = '/api';

export const tvApi = {
  async getStatus(): Promise<TVState> {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async connect(ip?: string, name?: string, mac?: string): Promise<{ success: boolean; state: TVState; protocol?: string; latency?: number }> {
    const res = await fetch(`${API_BASE}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, name, mac })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async disconnect(): Promise<{ success: boolean; state: TVState }> {
    const res = await fetch(`${API_BASE}/disconnect`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async sendCommand(command: string): Promise<{ success: boolean; command: string; protocol: string; message?: string }> {
    const res = await fetch(`${API_BASE}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async sendShortcut(appKey: string, customPackage?: string): Promise<{ success: boolean; app: string; protocol: string; message?: string }> {
    const res = await fetch(`${API_BASE}/shortcut`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: appKey, customPackage })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async sendText(text: string): Promise<{ success: boolean; text: string; message?: string }> {
    const res = await fetch(`${API_BASE}/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async triggerScan(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/scan`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async sendWakeOnLan(mac?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/wol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async updateConfig(newConfig: Record<string, unknown>): Promise<{ success: boolean; config: unknown }> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
};
