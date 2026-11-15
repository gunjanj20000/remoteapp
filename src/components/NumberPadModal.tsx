import React from 'react';
import { X, CornerDownLeft, Delete } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface NumberPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendCommand: (command: string) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const NumberPadModal: React.FC<NumberPadModalProps> = ({
  isOpen,
  onClose,
  onSendCommand,
  soundEnabled,
  hapticEnabled
}) => {
  if (!isOpen) return null;

  const handleDigit = (digit: number) => {
    playFeedback('click', soundEnabled, hapticEnabled);
    onSendCommand(`NUM_${digit}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100">
            TV Channel Keypad
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3x4 Numeric Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handleDigit(n)}
              className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-lg font-bold text-white active:scale-95 transition-all shadow-sm"
            >
              {n}
            </button>
          ))}

          {/* Dot / Back */}
          <button
            onClick={() => {
              playFeedback('click', soundEnabled, hapticEnabled);
              onSendCommand('BACK');
            }}
            className="py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-400 active:scale-95 transition-all"
          >
            Back
          </button>

          {/* 0 */}
          <button
            onClick={() => handleDigit(0)}
            className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-lg font-bold text-white active:scale-95 transition-all shadow-sm"
          >
            0
          </button>

          {/* Enter */}
          <button
            onClick={() => {
              playFeedback('click', soundEnabled, hapticEnabled);
              onSendCommand('ENTER');
              onClose();
            }}
            className="py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center active:scale-95 transition-all shadow-md"
          >
            <CornerDownLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
