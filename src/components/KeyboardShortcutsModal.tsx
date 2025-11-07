'use client';

import React from 'react';
import { X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose, theme }) => {
  if (!isOpen) return null;

  const bgColor = theme === 'dark' ? '#1f1f1f' : '#ffffff';
  const textColor = theme === 'dark' ? '#e5e7eb' : '#111827';
  const borderColor = theme === 'dark' ? '#3a3a39' : '#e5e7eb';
  const headerBgColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6';
  const separatorColor = theme === 'dark' ? '#4b5563' : '#d1d5db';
  const labelColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const keyBgColor = theme === 'dark' ? '#2a2a29' : '#f3f4f6';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 transition-colors duration-300"
        style={{ backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ backgroundColor: headerBgColor, color: textColor }}
        >
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-opacity-80 transition-colors"
            style={{ color: textColor }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor =
                theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <X size={20} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-4 space-y-3" style={{ color: textColor }}>
          {/* General Shortcuts */}
          <div className="flex justify-between items-center">
            <span className="text-sm">Search chats</span>
            <span 
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: keyBgColor }}
            >
              Ctrl + K
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Open new chat</span>
            <span 
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: keyBgColor }}
            >
              Ctrl + Shift + O
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Toggle sidebar</span>
            <span 
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: keyBgColor }}
            >
              Ctrl + Shift + S
            </span>
          </div>

          {/* Separator */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t" style={{ borderColor: separatorColor }} />
            <span className="flex-shrink mx-4 text-xs" style={{ color: labelColor }}>Chat</span>
            <div className="flex-grow border-t" style={{ borderColor: separatorColor }} />
          </div>

          {/* Chat-Specific Shortcuts */}
          <div className="flex justify-between items-center">
            <span className="text-sm">Delete chat</span>
            <span 
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: keyBgColor }}
            >
              Ctrl + Shift + Backspace
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Focus chat input</span>
            <span 
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: keyBgColor }}
            >
              Shift + Esc
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Add photos & files</span>
            <span 
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: keyBgColor }}
            >
              Ctrl + U
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;

