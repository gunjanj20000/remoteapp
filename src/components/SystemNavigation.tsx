import React from 'react';
import { ArrowLeft, Home, Menu } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface SystemNavigationProps {
  onSendCommand: (command: string) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const SystemNavigation: React.FC<SystemNavigationProps> = ({
  onSendCommand,
  soundEnabled,
  hapticEnabled
}) => {
  const handleNav = (cmd: string) => {
    playFeedback('navigate', soundEnabled, hapticEnabled);
    onSendCommand(cmd);
  };

  return (
    <div className="w-full px-6 py-2 flex items-center justify-between gap-4">
      {/* 1. BACK BUTTON */}
      <button
        onClick={() => handleNav('BACK')}
        title="Back"
        className="flex-1 py-3 px-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-zinc-300 hover:text-white flex flex-col items-center justify-center gap-1 shadow-md transition-all remote-btn"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-[10px] font-medium text-zinc-400">Back</span>
      </button>

      {/* 2. HOME BUTTON */}
      <button
        onClick={() => handleNav('HOME')}
        title="Home (Android TV / PatchWall)"
        className="flex-1 py-3 px-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-orange-500/60 active:scale-95 text-zinc-200 hover:text-orange-400 flex flex-col items-center justify-center gap-1 shadow-md transition-all remote-btn group"
      >
        <Home className="w-5 h-5 group-hover:text-orange-400 transition-colors" />
        <span className="text-[10px] font-medium text-zinc-400 group-hover:text-orange-400 transition-colors">
          Home
        </span>
      </button>

      {/* 3. MENU BUTTON */}
      <button
        onClick={() => handleNav('MENU')}
        title="Menu / Context Options"
        className="flex-1 py-3 px-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-zinc-300 hover:text-white flex flex-col items-center justify-center gap-1 shadow-md transition-all remote-btn"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] font-medium text-zinc-400">Menu</span>
      </button>
    </div>
  );
};
