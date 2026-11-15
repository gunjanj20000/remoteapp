import React, { useState } from 'react';
import { X, Send, CornerDownLeft, Delete } from 'lucide-react';
import { playFeedback } from '../utils/feedback';

interface KeyboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendText: (text: string) => void;
  onSendCommand: (command: string) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export const KeyboardModal: React.FC<KeyboardModalProps> = ({
  isOpen,
  onClose,
  onSendText,
  onSendCommand,
  soundEnabled,
  hapticEnabled
}) => {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleSend = () => {
    if (!inputText.trim()) return;
    playFeedback('click', soundEnabled, hapticEnabled);
    onSendText(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
      onSendCommand('ENTER');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <span>Type on TV</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 mb-3">
          Type on your phone to instantly enter text, search queries, or passwords on your Xiaomi TV screen.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            autoFocus
            placeholder="Type search query or text..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl font-semibold flex items-center justify-center transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Quick TV Control buttons while typing */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              playFeedback('click', soundEnabled, hapticEnabled);
              onSendCommand('BACK');
            }}
            className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 rounded-lg transition-colors"
          >
            Backspace
          </button>
          <button
            onClick={() => {
              playFeedback('click', soundEnabled, hapticEnabled);
              onSendCommand('ENTER');
            }}
            className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-orange-400 font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            <span>Search / Enter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
