import React from 'react';
import { Power, Wifi, WifiOff, Volume2, VolumeX, Smartphone, Settings, Keyboard, Activity } from 'lucide-react';
import { TVState } from '../services/tvApi';
import { playFeedback } from '../utils/feedback';

interface HeaderProps {
  tvState: TVState | null;
  onPowerClick: () => void;
  onSettingsClick: () => void;
  onKeyboardClick: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  hapticEnabled: boolean;
  onToggleHaptic: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tvState,
  onPowerClick,
  onSettingsClick,
  onKeyboardClick,
  soundEnabled,
  onToggleSound,
  hapticEnabled,
  onToggleHaptic
}) => {
  const isConnected = tvState?.connected ?? false;
  const isPowerOn = tvState?.powerState === 'on';

  return (
    <header className="w-full pt-3 pb-2 px-4 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-20">
      {/* Brand & TV Info */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6900] to-[#e05300] flex items-center justify-center shadow-lg shadow-orange-500/20 font-bold text-white text-xs tracking-tighter">
          mi
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-semibold tracking-wide text-zinc-100">
              {tvState?.name || 'Xiaomi TV'}
            </h1>
            <button
              onClick={onSettingsClick}
              title="Connection Settings"
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {isConnected ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-3 h-3" />
                <span>{tvState?.ip || 'Connected'}</span>
                {tvState?.latencyMs !== null && (
                  <span className="text-[10px] text-zinc-500 ml-1">
                    {tvState?.latencyMs}ms
                  </span>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <WifiOff className="w-3 h-3" />
                <span>Disconnected</span>
              </span>
            )}
            {tvState?.protocol && tvState.protocol !== 'none' && (
              <span className="text-[9px] uppercase px-1.5 py-0.2 bg-zinc-800 text-zinc-400 rounded">
                {tvState.protocol}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Controls */}
      <div className="flex items-center gap-1.5">
        {/* Phone-to-TV Keyboard */}
        <button
          onClick={() => {
            playFeedback('click', soundEnabled, hapticEnabled);
            onKeyboardClick();
          }}
          title="Send Text / Keyboard to TV"
          className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 active:scale-95 text-zinc-300 transition-all"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Audio click feedback toggle */}
        <button
          onClick={() => {
            onToggleSound();
            playFeedback('click', !soundEnabled, hapticEnabled);
          }}
          title={soundEnabled ? 'Mute Button Sound' : 'Enable Button Sound'}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            soundEnabled ? 'bg-zinc-800 text-orange-400' : 'bg-zinc-900/80 text-zinc-500'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Haptic vibration feedback toggle */}
        <button
          onClick={() => {
            onToggleHaptic();
            playFeedback('click', soundEnabled, !hapticEnabled);
          }}
          title={hapticEnabled ? 'Haptics ON' : 'Haptics OFF'}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            hapticEnabled ? 'bg-zinc-800 text-orange-400' : 'bg-zinc-900/80 text-zinc-500'
          }`}
        >
          <Smartphone className="w-4 h-4" />
        </button>

        {/* TV Power button */}
        <button
          onClick={() => {
            playFeedback('power', soundEnabled, hapticEnabled);
            onPowerClick();
          }}
          title="TV Power On / Standby"
          className={`ml-1 p-2.5 rounded-full transition-all active:scale-90 shadow-md ${
            isPowerOn
              ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500 hover:text-white shadow-red-500/20'
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-red-400'
          }`}
        >
          <Power className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
