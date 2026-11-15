import React, { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Disc, Hand, MousePointer } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface DPadControllerProps {
  onSendCommand: (command: string) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const DPadController: React.FC<DPadControllerProps> = ({
  onSendCommand,
  soundEnabled,
  hapticEnabled
}) => {
  const [controlMode, setControlMode] = useState<'dpad' | 'touchpad'>('dpad');
  const [swipeFlash, setSwipeFlash] = useState<string | null>(null);

  // Touchpad touch tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleCommand = (cmd: string) => {
    playFeedback('navigate', soundEnabled, hapticEnabled);
    onSendCommand(cmd);
  };

  // Touchpad touch handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartRef.current) return;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;

    const dx = clientX - touchStartRef.current.x;
    const dy = clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Tap detection (< 15px movement and < 300ms)
    if (distance < 15 && dt < 350) {
      handleCommand('OK');
      flashFeedback('OK');
    } else if (distance >= 30) {
      // Swipe detection
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          handleCommand('RIGHT');
          flashFeedback('RIGHT');
        } else {
          handleCommand('LEFT');
          flashFeedback('LEFT');
        }
      } else {
        if (dy > 0) {
          handleCommand('DOWN');
          flashFeedback('DOWN');
        } else {
          handleCommand('UP');
          flashFeedback('UP');
        }
      }
    }

    touchStartRef.current = null;
  };

  const flashFeedback = (direction: string) => {
    setSwipeFlash(direction);
    setTimeout(() => setSwipeFlash(null), 300);
  };

  return (
    <div className="w-full flex flex-col items-center py-2 px-4">
      {/* Mode Switcher Tab */}
      <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-full border border-zinc-800/80 mb-3 shadow-inner">
        <button
          onClick={() => {
            playFeedback('click', soundEnabled, hapticEnabled);
            setControlMode('dpad');
          }}
          className={`px-3 py-1 text-[11px] font-semibold rounded-full flex items-center gap-1.5 transition-all ${
            controlMode === 'dpad'
              ? 'bg-zinc-700 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Disc className="w-3.5 h-3.5 text-orange-400" />
          D-Pad
        </button>
        <button
          onClick={() => {
            playFeedback('click', soundEnabled, hapticEnabled);
            setControlMode('touchpad');
          }}
          className={`px-3 py-1 text-[11px] font-semibold rounded-full flex items-center gap-1.5 transition-all ${
            controlMode === 'touchpad'
              ? 'bg-zinc-700 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Hand className="w-3.5 h-3.5 text-orange-400" />
          Touchpad
        </button>
      </div>

      {/* D-Pad Mode */}
      {controlMode === 'dpad' ? (
        <div className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-full dpad-dial border-2 border-zinc-700/60 flex items-center justify-center p-2 select-none shadow-2xl">
          {/* UP Button */}
          <button
            onClick={() => handleCommand('UP')}
            title="Up"
            className="absolute top-1 left-1/2 -translate-x-1/2 w-24 h-16 flex items-start justify-center pt-2 rounded-t-full text-zinc-300 hover:text-white active:text-orange-400 active:scale-95 transition-all"
          >
            <ChevronUp className="w-7 h-7 filter drop-shadow" />
          </button>

          {/* DOWN Button */}
          <button
            onClick={() => handleCommand('DOWN')}
            title="Down"
            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-24 h-16 flex items-end justify-center pb-2 rounded-b-full text-zinc-300 hover:text-white active:text-orange-400 active:scale-95 transition-all"
          >
            <ChevronDown className="w-7 h-7 filter drop-shadow" />
          </button>

          {/* LEFT Button */}
          <button
            onClick={() => handleCommand('LEFT')}
            title="Left"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-16 h-24 flex items-center justify-start pl-2 rounded-l-full text-zinc-300 hover:text-white active:text-orange-400 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-7 h-7 filter drop-shadow" />
          </button>

          {/* RIGHT Button */}
          <button
            onClick={() => handleCommand('RIGHT')}
            title="Right"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-16 h-24 flex items-center justify-end pr-2 rounded-r-full text-zinc-300 hover:text-white active:text-orange-400 active:scale-95 transition-all"
          >
            <ChevronRight className="w-7 h-7 filter drop-shadow" />
          </button>

          {/* Center OK Button */}
          <button
            onClick={() => handleCommand('OK')}
            title="OK / Select"
            className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-b from-[#2c313d] to-[#1c1f26] border border-zinc-600/70 hover:border-orange-500/80 active:border-orange-500 flex items-center justify-center text-sm font-bold text-white shadow-lg active:scale-90 active:shadow-inner transition-all group"
          >
            <span className="tracking-wider group-active:text-orange-400">OK</span>
          </button>
        </div>
      ) : (
        /* Touchpad Mode */
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          className="relative w-64 h-52 sm:w-72 sm:h-56 rounded-3xl bg-zinc-900/90 border-2 border-zinc-700/80 flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden shadow-2xl hover:border-orange-500/50 transition-colors"
        >
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Swipe Flash Visual Indicator */}
          {swipeFlash && (
            <div className="absolute inset-0 bg-orange-500/15 flex items-center justify-center pointer-events-none animate-in fade-in duration-100">
              <span className="text-xl font-bold text-orange-400 tracking-wider">
                {swipeFlash}
              </span>
            </div>
          )}

          <MousePointer className="w-6 h-6 text-orange-400 mb-2 opacity-80 animate-pulse pointer-events-none" />
          <p className="text-xs font-semibold text-zinc-300 pointer-events-none">
            Swipe to Navigate
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5 pointer-events-none">
            Tap anywhere for OK
          </p>
        </div>
      )}
    </div>
  );
};
