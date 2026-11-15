import React from 'react';
import { Play, Sparkles, Plus, ExternalLink, Music, Film, Tv } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface ShortcutGridProps {
  onLaunchApp: (appKey: string, customPackage?: string) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  activeApp?: string;
}

export const ShortcutGrid: React.FC<ShortcutGridProps> = ({
  onLaunchApp,
  soundEnabled,
  hapticEnabled,
  activeApp
}) => {
  const [showMoreApps, setShowMoreApps] = React.useState(false);
  const [customPackageInput, setCustomPackageInput] = React.useState('');
  const [showCustomModal, setShowCustomModal] = React.useState(false);

  const handleLaunch = (key: string, customPkg?: string) => {
    playFeedback('shortcut', soundEnabled, hapticEnabled);
    onLaunchApp(key, customPkg);
  };

  return (
    <div className="w-full px-4 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-orange-400" />
          Direct App Shortcuts
        </span>
        {activeApp && activeApp !== 'Home' && (
          <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-medium">
            Active: {activeApp}
          </span>
        )}
      </div>

      {/* Main 4 Primary Shortcuts requested by user: YouTube, Netflix, Sony LIV, Prime Video */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* 1. YOUTUBE */}
        <button
          onClick={() => handleLaunch('YOUTUBE')}
          className={`relative group overflow-hidden rounded-2xl p-3 flex items-center gap-2.5 transition-all active:scale-95 shadow-md border ${
            activeApp === 'YouTube'
              ? 'border-red-500 ring-2 ring-red-500/30'
              : 'border-red-950/40 hover:border-red-700/60'
          } bg-gradient-to-br from-[#2b0808] via-[#1a0808] to-[#120505]`}
        >
          <div className="w-9 h-7 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1">
              YouTube
            </div>
            <div className="text-[10px] text-zinc-400 truncate">4K Stream</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500/40 group-hover:bg-red-400 transition-colors" />
        </button>

        {/* 2. NETFLIX */}
        <button
          onClick={() => handleLaunch('NETFLIX')}
          className={`relative group overflow-hidden rounded-2xl p-3 flex items-center gap-2.5 transition-all active:scale-95 shadow-md border ${
            activeApp === 'Netflix'
              ? 'border-red-600 ring-2 ring-red-600/30'
              : 'border-zinc-800 hover:border-red-800/60'
          } bg-gradient-to-br from-[#1c1214] via-[#111216] to-[#0c0d10]`}
        >
          <div className="w-9 h-7 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <span className="text-red-600 font-black text-sm tracking-tighter">N</span>
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-bold text-red-500 tracking-wider">
              NETFLIX
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Movies & TV</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-red-600/40 group-hover:bg-red-500 transition-colors" />
        </button>

        {/* 3. SONY LIV */}
        <button
          onClick={() => handleLaunch('SONYLIV')}
          className={`relative group overflow-hidden rounded-2xl p-3 flex items-center gap-2.5 transition-all active:scale-95 shadow-md border ${
            activeApp === 'Sony LIV'
              ? 'border-blue-500 ring-2 ring-blue-500/30'
              : 'border-blue-950/50 hover:border-blue-600/60'
          } bg-gradient-to-br from-[#0c1c38] via-[#09152b] to-[#060e1d]`}
        >
          <div className="w-9 h-7 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
            <span className="text-white font-extrabold text-[11px] tracking-tight">LIV</span>
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-bold text-sky-400 tracking-tight">
              Sony LIV
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Sports & Shows</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-sky-500/40 group-hover:bg-sky-400 transition-colors" />
        </button>

        {/* 4. PRIME VIDEO */}
        <button
          onClick={() => handleLaunch('PRIME_VIDEO')}
          className={`relative group overflow-hidden rounded-2xl p-3 flex items-center gap-2.5 transition-all active:scale-95 shadow-md border ${
            activeApp === 'Prime Video'
              ? 'border-cyan-500 ring-2 ring-cyan-500/30'
              : 'border-sky-950/50 hover:border-cyan-600/60'
          } bg-gradient-to-br from-[#092236] via-[#081a29] to-[#05111b]`}
        >
          <div className="w-9 h-7 rounded-lg bg-[#00A8E1] flex items-center justify-center shadow-md shadow-cyan-500/30 group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm font-bold text-[#00A8E1] tracking-tight">
              prime
            </div>
            <div className="text-[10px] text-zinc-400 truncate">Amazon Video</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40 group-hover:bg-cyan-300 transition-colors" />
        </button>
      </div>

      {/* Expandable Extra Apps Row */}
      <div className="mt-2">
        <button
          onClick={() => setShowMoreApps(!showMoreApps)}
          className="w-full py-1 text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 transition-colors"
        >
          <span>{showMoreApps ? 'Hide Extra Apps ▲' : 'More Apps & Custom Launcher ▼'}</span>
        </button>

        {showMoreApps && (
          <div className="mt-1.5 pt-2 border-t border-zinc-800/80 grid grid-cols-4 gap-2 animate-in fade-in duration-200">
            {/* Hotstar */}
            <button
              onClick={() => handleLaunch('HOTSTAR')}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-blue-700 flex flex-col items-center gap-1 active:scale-95 transition-all"
            >
              <div className="w-6 h-6 rounded bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white">
                ★
              </div>
              <span className="text-[10px] text-zinc-300 font-medium">Hotstar</span>
            </button>

            {/* Spotify */}
            <button
              onClick={() => handleLaunch('SPOTIFY')}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-700 flex flex-col items-center gap-1 active:scale-95 transition-all"
            >
              <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center">
                <Music className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] text-zinc-300 font-medium">Spotify</span>
            </button>

            {/* PatchWall */}
            <button
              onClick={() => handleLaunch('PATCHWALL')}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-orange-600 flex flex-col items-center gap-1 active:scale-95 transition-all"
            >
              <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <Tv className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] text-zinc-300 font-medium">PatchWall</span>
            </button>

            {/* Custom App */}
            <button
              onClick={() => setShowCustomModal(true)}
              className="p-2 rounded-xl bg-zinc-900/80 border border-dashed border-zinc-700 hover:border-zinc-500 flex flex-col items-center gap-1 active:scale-95 transition-all"
            >
              <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">Custom</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal for Launching Custom Package */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-orange-400" />
              Launch Custom App on TV
            </h3>
            <p className="text-xs text-zinc-400 mb-3">
              Enter the Android package name of any app installed on your Xiaomi TV (e.g. <code>com.plexapp.android</code>, <code>tv.twitch.android.app</code>).
            </p>
            <input
              type="text"
              placeholder="e.g. com.plexapp.android"
              value={customPackageInput}
              onChange={(e) => setCustomPackageInput(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500 mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (customPackageInput.trim()) {
                    handleLaunch('CUSTOM', customPackageInput.trim());
                    setShowCustomModal(false);
                    setCustomPackageInput('');
                  }
                }}
                disabled={!customPackageInput.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl shadow-md transition-colors"
              >
                Launch on TV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
