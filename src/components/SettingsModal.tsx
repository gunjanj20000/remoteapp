import React, { useState } from 'react';
import { X, Wifi, Search, RefreshCw, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Terminal } from 'lucide-react';
import { TVState, tvApi } from '../services/tvApi';
import { playFeedback } from '../utils/feedback';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tvState: TVState | null;
  onConnect: (ip: string, name?: string, mac?: string) => Promise<void>;
  onTriggerScan: () => Promise<void>;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  tvState,
  onConnect,
  onTriggerScan,
  soundEnabled,
  hapticEnabled
}) => {
  const [tvIpInput, setTvIpInput] = useState(tvState?.config?.tvIp || tvState?.ip || '10.0.0.100');
  const [tvNameInput, setTvNameInput] = useState(tvState?.config?.tvName || tvState?.name || 'Xiaomi Smart TV');
  const [tvMacInput, setTvMacInput] = useState(tvState?.config?.tvMac || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'logs'>('connection');

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!tvIpInput.trim()) return;
    setIsConnecting(true);
    playFeedback('click', soundEnabled, hapticEnabled);
    try {
      await onConnect(tvIpInput.trim(), tvNameInput.trim(), tvMacInput.trim());
    } finally {
      setIsConnecting(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    playFeedback('click', soundEnabled, hapticEnabled);
    try {
      await onTriggerScan();
    } finally {
      setIsScanning(false);
    }
  };

  const handleWakeOnLan = async () => {
    playFeedback('power', soundEnabled, hapticEnabled);
    await tvApi.sendWakeOnLan(tvMacInput.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                TV Wi-Fi Settings & Setup
              </h2>
              <span className="text-[10px] text-zinc-400">
                Automatic connection on startup
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-zinc-950 p-1 rounded-xl my-3 border border-zinc-800/80">
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'connection'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Wi-Fi Connection
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'logs'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live Logs ({tvState?.logHistory.length || 0})</span>
          </button>
        </div>

        {activeTab === 'connection' ? (
          <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
            {/* Status Banner */}
            <div
              className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
                tvState?.connected
                  ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                  : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
              }`}
            >
              {tvState?.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs">
                <div className="font-semibold">
                  {tvState?.connected
                    ? `Connected to ${tvState.name || 'Xiaomi TV'}`
                    : 'TV Offline or Connecting...'}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  {tvState?.connected
                    ? `IP: ${tvState.ip} • Protocol: ${tvState.protocol.toUpperCase()} • Ping: ${tvState.latencyMs || 0}ms`
                    : 'App automatically tries to connect on launch. Enter your TV IP below or scan your Wi-Fi network.'}
                </div>
              </div>
            </div>

            {/* TV IP Address Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Xiaomi TV IP Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.100 or 10.0.0.100"
                  value={tvIpInput}
                  onChange={(e) => setTvIpInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !tvIpInput.trim()}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  {isConnecting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  <span>Connect</span>
                </button>
              </div>
            </div>

            {/* Network Auto-Discovery */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-zinc-200">
                  Wi-Fi Subnet Auto-Scan
                </span>
                <button
                  onClick={handleScan}
                  disabled={isScanning || tvState?.isScanning}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Search className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning || tvState?.isScanning ? 'Scanning...' : 'Scan Wi-Fi'}</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400">
                Automatically sweeps ports 5555 (ADB), 6095 (MiTV HTTP), and 8008 (DIAL) across your home Wi-Fi to find your Xiaomi TV.
              </p>
            </div>

            {/* TV Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                TV Name / Label
              </label>
              <input
                type="text"
                placeholder="Xiaomi Mi TV 4K"
                value={tvNameInput}
                onChange={(e) => setTvNameInput(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* TV MAC Address for Wake-on-LAN */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                <span>TV MAC Address (Optional - for Wake from Standby)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AA:BB:CC:DD:EE:FF"
                  value={tvMacInput}
                  onChange={(e) => setTvMacInput(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={handleWakeOnLan}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Send Wake-on-LAN packet"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Wake TV</span>
                </button>
              </div>
            </div>

            {/* Permissions Granted Notice */}
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 flex items-center gap-2 text-xs">
              <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
              <span>All permissions granted: Auto-Connect, Vibration, Web Audio & Wi-Fi Active.</span>
            </div>
          </div>
        ) : (
          /* Live Logs Tab */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 font-mono text-[11px] space-y-1.5">
              {tvState?.logHistory && tvState.logHistory.length > 0 ? (
                tvState.logHistory.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                    <span
                      className={`break-all ${
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'error'
                          ? 'text-red-400'
                          : log.type === 'warn'
                          ? 'text-amber-400'
                          : 'text-zinc-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-zinc-600 text-center py-6">No logs yet.</div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 mt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
