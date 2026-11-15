import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ShortcutGrid } from './components/ShortcutGrid';
import { DPadController } from './components/DPadController';
import { SystemNavigation } from './components/SystemNavigation';
import { VolumeAndChannel } from './components/VolumeAndChannel';
import { MediaControls } from './components/MediaControls';
import { KeyboardModal } from './components/KeyboardModal';
import { NumberPadModal } from './components/NumberPadModal';
import { SettingsModal } from './components/SettingsModal';
import { tvApi, TVState } from './services/tvApi';
import { playFeedback } from './utils/feedback';

export const App: React.FC = () => {
  const [tvState, setTvState] = useState<TVState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('mi_remote_sound') !== 'false';
  });
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    return localStorage.getItem('mi_remote_haptic') !== 'false';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isNumberPadOpen, setIsNumberPadOpen] = useState(false);

  // Transient feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  // Sync audio/haptic preferences
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('mi_remote_sound', String(next));
    showToast(next ? 'Sound Click: ON' : 'Sound Click: OFF');
  };

  const handleToggleHaptic = () => {
    const next = !hapticEnabled;
    setHapticEnabled(next);
    localStorage.setItem('mi_remote_haptic', String(next));
    showToast(next ? 'Haptic Vibration: ON' : 'Haptic Vibration: OFF');
  };

  // Immediate Wi-Fi connection on opening
  const fetchStatusAndConnect = useCallback(async () => {
    try {
      const state = await tvApi.getStatus();
      setTvState(state);

      // If not connected yet, initiate immediate Wi-Fi connect
      if (!state.connected && state.config?.tvIp) {
        showToast(`Connecting to ${state.config.tvIp}...`);
        const res = await tvApi.connect(state.config.tvIp);
        if (res.state) {
          setTvState(res.state);
        }
      }
    } catch {
      // In offline/dev environment without server
      console.warn('API connection failed. Retrying in background...');
    }
  }, [showToast]);

  useEffect(() => {
    fetchStatusAndConnect();

    // Heartbeat status poll every 4 seconds
    const interval = setInterval(async () => {
      try {
        const state = await tvApi.getStatus();
        setTvState(state);
      } catch {
        // Ignore background polling errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchStatusAndConnect]);

  // Command sender handler
  const handleSendCommand = async (command: string) => {
    try {
      const res = await tvApi.sendCommand(command);
      if (res.message) {
        showToast(res.message);
      }
      // Optimistic state updates
      if (command === 'VOLUME_UP' && tvState) {
        setTvState({ ...tvState, volume: Math.min(100, tvState.volume + 5), muted: false });
      } else if (command === 'VOLUME_DOWN' && tvState) {
        setTvState({ ...tvState, volume: Math.max(0, tvState.volume - 5), muted: false });
      } else if (command === 'MUTE' && tvState) {
        setTvState({ ...tvState, muted: !tvState.muted });
      } else if (command === 'POWER' && tvState) {
        const nextPower = tvState.powerState === 'on' ? 'off' : 'on';
        setTvState({ ...tvState, powerState: nextPower });
        showToast(`TV Power: ${nextPower.toUpperCase()}`);
      }
    } catch (err: unknown) {
      showToast(`Command error: ${(err as Error).message}`);
    }
  };

  // Shortcut App Launcher handler (YouTube, Netflix, Sony LIV, Prime Video)
  const handleLaunchApp = async (appKey: string, customPkg?: string) => {
    try {
      showToast(`Launching ${customPkg || appKey}...`);
      const res = await tvApi.sendShortcut(appKey, customPkg);
      if (res.success) {
        showToast(`Opened ${res.app} on TV`);
        if (tvState) {
          setTvState({ ...tvState, activeApp: res.app });
        }
      }
    } catch (err: unknown) {
      showToast(`Launch failed: ${(err as Error).message}`);
    }
  };

  // Text input handler
  const handleSendText = async (text: string) => {
    try {
      await tvApi.sendText(text);
      showToast(`Sent: "${text}"`);
    } catch (err: unknown) {
      showToast(`Error sending text: ${(err as Error).message}`);
    }
  };

  // Settings connect handler
  const handleConnect = async (ip: string, name?: string, mac?: string) => {
    showToast(`Connecting to ${ip}...`);
    try {
      const res = await tvApi.connect(ip, name, mac);
      if (res.state) {
        setTvState(res.state);
        showToast(`Connected to ${ip}!`);
      }
    } catch (err: unknown) {
      showToast(`Connection failed: ${(err as Error).message}`);
    }
  };

  // Subnet scan handler
  const handleTriggerScan = async () => {
    showToast('Subnet scan started...');
    try {
      await tvApi.triggerScan();
      showToast('Scanning local Wi-Fi for Xiaomi TV...');
    } catch (err: unknown) {
      showToast(`Scan error: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080a] flex flex-col items-center justify-start p-0 sm:py-6 sm:px-4">
      {/* Phone Remote Container */}
      <div className="w-full max-w-md bg-[#13151b] border-x sm:border border-zinc-800/90 sm:rounded-[40px] shadow-2xl flex flex-col min-h-screen sm:min-h-0 sm:max-h-[94vh] overflow-hidden remote-surface">
        
        {/* Top Header with Wi-Fi Status & Settings */}
        <Header
          tvState={tvState}
          onPowerClick={() => handleSendCommand('POWER')}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onKeyboardClick={() => setIsKeyboardOpen(true)}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          hapticEnabled={hapticEnabled}
          onToggleHaptic={handleToggleHaptic}
        />

        {/* Scrollable Remote Body */}
        <div className="flex-1 overflow-y-auto pb-6 space-y-1">
          
          {/* Quick Shortcuts: YouTube, Netflix, Sony LIV, Prime Video */}
          <ShortcutGrid
            onLaunchApp={handleLaunchApp}
            soundEnabled={soundEnabled}
            hapticEnabled={hapticEnabled}
            activeApp={tvState?.activeApp}
          />

          {/* Directional Pad / Touchpad */}
          <DPadController
            onSendCommand={handleSendCommand}
            soundEnabled={soundEnabled}
            hapticEnabled={hapticEnabled}
          />

          {/* Iconic Xiaomi Navigation: Back, Home, Menu */}
          <SystemNavigation
            onSendCommand={handleSendCommand}
            soundEnabled={soundEnabled}
            hapticEnabled={hapticEnabled}
          />

          {/* Volume Rocker & Channel Controls */}
          <VolumeAndChannel
            volume={tvState?.volume ?? 35}
            isMuted={tvState?.muted ?? false}
            onSendCommand={handleSendCommand}
            onOpenNumberPad={() => setIsNumberPadOpen(true)}
            soundEnabled={soundEnabled}
            hapticEnabled={hapticEnabled}
          />

          {/* Media Playback & TV Source Selection */}
          <MediaControls
            onSendCommand={handleSendCommand}
            soundEnabled={soundEnabled}
            hapticEnabled={hapticEnabled}
          />

          {/* Subtle Bottom Xiaomi Mi Watermark */}
          <div className="pt-2 flex flex-col items-center justify-center text-zinc-600 text-[11px] select-none">
            <span className="font-semibold tracking-widest text-zinc-500">XIAOMI</span>
            <span className="text-[9px] text-zinc-600">Smart TV Remote • Wi-Fi Active</span>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed sm:absolute bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-900/95 border border-zinc-700/80 rounded-2xl shadow-xl text-xs font-semibold text-zinc-100 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
            {toastMessage}
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <KeyboardModal
        isOpen={isKeyboardOpen}
        onClose={() => setIsKeyboardOpen(false)}
        onSendText={handleSendText}
        onSendCommand={handleSendCommand}
        soundEnabled={soundEnabled}
        hapticEnabled={hapticEnabled}
      />

      <NumberPadModal
        isOpen={isNumberPadOpen}
        onClose={() => setIsNumberPadOpen(false)}
        onSendCommand={handleSendCommand}
        soundEnabled={soundEnabled}
        hapticEnabled={hapticEnabled}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        tvState={tvState}
        onConnect={handleConnect}
        onTriggerScan={handleTriggerScan}
        soundEnabled={soundEnabled}
        hapticEnabled={hapticEnabled}
      />
    </div>
  );
};
