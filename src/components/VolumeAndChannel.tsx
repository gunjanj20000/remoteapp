import React from 'react';
import { Plus, Minus, VolumeX, Volume2, ChevronUp, ChevronDown, Hash } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface VolumeAndChannelProps {
  volume: number;
  isMuted: boolean;
  onSendCommand: (command: string) => void;
  onOpenNumberPad: () => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const VolumeAndChannel: React.FC<VolumeAndChannelProps> = ({
  volume,
  isMuted,
  onSendCommand,
  onOpenNumberPad,
  soundEnabled,
  hapticEnabled
}) => {
  const handleAction = (cmd: string) => {
    playFeedback('click', soundEnabled, hapticEnabled);
    onSendCommand(cmd);
  };

  return (
    <div className="w-full px-6 py-2">
      <div className="flex items-center justify-between gap-4">
        {/* Left Rocker: Volume Up, Mute, Volume Down */}
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-1.5 flex flex-col items-center justify-between shadow-lg">
          {/* Volume Up */}
          <button
            onClick={() => handleAction('VOLUME_UP')}
            title="Volume Up"
            className="w-full py-2.5 rounded-2xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Mute Button */}
          <button
            onClick={() => handleAction('MUTE')}
            title={isMuted ? 'Unmute' : 'Mute'}
            className={`w-full py-2 rounded-xl my-1 flex items-center justify-center text-xs font-semibold transition-all active:scale-95 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Volume Down */}
          <button
            onClick={() => handleAction('VOLUME_DOWN')}
            title="Volume Down"
            className="w-full py-2.5 rounded-2xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <Minus className="w-5 h-5" />
          </button>

          <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold mt-1">
            VOL
          </span>
        </div>

        {/* Center Volume Level Meter */}
        <div className="flex flex-col items-center justify-center px-2">
          <div className="w-2.5 h-24 bg-zinc-900 border border-zinc-800 rounded-full p-0.5 flex flex-col justify-end overflow-hidden">
            <div
              className={`w-full rounded-full transition-all duration-200 ${
                isMuted
                  ? 'bg-red-500/40'
                  : 'bg-gradient-to-t from-orange-500 to-amber-400'
              }`}
              style={{ height: isMuted ? '100%' : `${volume}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-400 mt-1 font-semibold">
            {isMuted ? 'MUTE' : `${volume}%`}
          </span>
        </div>

        {/* Right Rocker: Channel Up, Numpad, Channel Down */}
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-1.5 flex flex-col items-center justify-between shadow-lg">
          {/* Channel Up */}
          <button
            onClick={() => handleAction('CHANNEL_UP')}
            title="Channel Up"
            className="w-full py-2.5 rounded-2xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <ChevronUp className="w-5 h-5" />
          </button>

          {/* Open Numeric Keypad */}
          <button
            onClick={() => {
              playFeedback('click', soundEnabled, hapticEnabled);
              onOpenNumberPad();
            }}
            title="Open 10-Key Number Pad"
            className="w-full py-2 rounded-xl my-1 flex items-center justify-center text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <Hash className="w-4 h-4" />
          </button>

          {/* Channel Down */}
          <button
            onClick={() => handleAction('CHANNEL_DOWN')}
            title="Channel Down"
            className="w-full py-2.5 rounded-2xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-semibold mt-1">
            CH
          </span>
        </div>
      </div>
    </div>
  );
};
