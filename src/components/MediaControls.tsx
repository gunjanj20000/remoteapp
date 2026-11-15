import React, { useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Square, Tv2, Sliders, Mic } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface MediaControlsProps {
  onSendCommand: (command: string) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const MediaControls: React.FC<MediaControlsProps> = ({
  onSendCommand,
  soundEnabled,
  hapticEnabled
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInputSelector, setShowInputSelector] = useState(false);

  const handleAction = (cmd: string) => {
    playFeedback('click', soundEnabled, hapticEnabled);
    if (cmd === 'PLAY_PAUSE') {
      setIsPlaying(!isPlaying);
    }
    onSendCommand(cmd);
  };

  return (
    <div className="w-full px-6 py-2">
      {/* Media Playback Controls Row */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 flex items-center justify-around shadow-md mb-2">
        {/* Rewind */}
        <button
          onClick={() => handleAction('REWIND')}
          title="Rewind 10s"
          className="p-2 text-zinc-400 hover:text-white active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Play / Pause Toggle */}
        <button
          onClick={() => handleAction('PLAY_PAUSE')}
          title={isPlaying ? 'Pause' : 'Play'}
          className="p-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-orange-400 hover:text-orange-300 active:scale-90 shadow transition-all"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* Fast Forward */}
        <button
          onClick={() => handleAction('FAST_FORWARD')}
          title="Fast Forward 10s"
          className="p-2 text-zinc-400 hover:text-white active:scale-95 transition-all"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        {/* Stop */}
        <button
          onClick={() => handleAction('STOP')}
          title="Stop"
          className="p-2 text-zinc-400 hover:text-white active:scale-95 transition-all"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input Source & TV Functions Row */}
      <div className="flex items-center justify-between gap-2">
        {/* Input Source Selector */}
        <button
          onClick={() => {
            playFeedback('click', soundEnabled, hapticEnabled);
            setShowInputSelector(!showInputSelector);
          }}
          className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-zinc-300 flex items-center justify-center gap-1.5 text-xs font-medium shadow-sm transition-all"
        >
          <Tv2 className="w-3.5 h-3.5 text-orange-400" />
          <span>Source Input</span>
        </button>

        {/* Quick TV Settings */}
        <button
          onClick={() => handleAction('SETTINGS')}
          title="Open TV Settings"
          className="py-2 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-zinc-300 flex items-center justify-center gap-1.5 text-xs font-medium shadow-sm transition-all"
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <span>Settings</span>
        </button>

        {/* Google Assistant / Voice Search */}
        <button
          onClick={() => handleAction('VOICE_ASSISTANT')}
          title="Google Assistant"
          className="py-2 px-3 rounded-xl bg-gradient-to-r from-blue-900/40 via-red-900/40 to-yellow-900/40 border border-zinc-700 hover:border-zinc-500 active:scale-95 text-zinc-200 flex items-center justify-center gap-1.5 text-xs font-medium shadow-sm transition-all"
        >
          <Mic className="w-3.5 h-3.5 text-amber-400" />
          <span>Assistant</span>
        </button>
      </div>

      {/* Input Source Modal / Dropdown */}
      {showInputSelector && (
        <div className="mt-2 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl grid grid-cols-4 gap-2 animate-in fade-in duration-150">
          {['HDMI 1', 'HDMI 2', 'HDMI 3', 'AV / TV'].map((source) => (
            <button
              key={source}
              onClick={() => {
                handleAction(`INPUT_${source.replace(/\s+/g, '_')}`);
                setShowInputSelector(false);
              }}
              className="py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-orange-500/20 hover:text-orange-400 border border-zinc-700 text-xs font-semibold text-zinc-200 active:scale-95 transition-all"
            >
              {source}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
