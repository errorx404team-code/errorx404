import React, { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';

// ─── Menu definitions ────────────────────────────────────────────────────────

const MENUS = [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: 'Upload File…',       shortcut: 'Ctrl+O',    action: 'upload-file' },
      { label: 'Upload Folder…',     shortcut: 'Ctrl+Shift+O', action: 'upload-folder' },
      { divider: true },
      { label: 'Export Python…',     shortcut: 'Ctrl+Shift+S', action: 'export' },
      { divider: true },
      { label: 'Close Routine',      shortcut: 'Ctrl+W',    action: 'close' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { label: 'Copy Source Code',   shortcut: 'Ctrl+C',    action: 'copy-source' },
      { label: 'Copy Converted Code',shortcut: 'Ctrl+Shift+C', action: 'copy-converted' },
      { divider: true },
      { label: 'Find in Code',       shortcut: 'Ctrl+F',    action: 'find' },
    ],
  },
  {
    id: 'selection',
    label: 'Selection',
    items: [
      { label: 'Select All',         shortcut: 'Ctrl+A',    action: 'select-all' },
      { divider: true },
      { label: 'Toggle Split View',  shortcut: 'Ctrl+\\',   action: 'toggle-split' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { label: 'Explorer',           shortcut: 'Ctrl+Shift+E', action: 'view-explorer' },
      { label: 'Dashboard',          shortcut: 'Ctrl+Shift+D', action: 'view-dashboard' },
      { divider: true },
      { label: 'Toggle Bottom Panel',shortcut: 'Ctrl+J',    action: 'toggle-bottom' },
      { label: 'Toggle AI Chat',     shortcut: 'Ctrl+Shift+A', action: 'toggle-chat' },
      { divider: true },
      { label: 'Split View',         shortcut: '',          action: 'split' },
      { label: 'Source Only',        shortcut: '',          action: 'source-only' },
      { label: 'Output Only',        shortcut: '',          action: 'output-only' },
    ],
  },
  {
    id: 'go',
    label: 'Go',
    items: [
      { label: 'Next Routine',       shortcut: 'Alt+→',     action: 'next-routine' },
      { label: 'Previous Routine',   shortcut: 'Alt+←',     action: 'prev-routine' },
      { divider: true },
      { label: 'Go to Dashboard',    shortcut: '',          action: 'view-dashboard' },
      { label: 'Go to Dependency Graph', shortcut: '',      action: 'view-graph' },
      { label: 'Go to Business Logic Map', shortcut: '',    action: 'view-partition' },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MenuBar({ onAction }) {
  const [openMenu, setOpenMenu] = useState(null);
  const barRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleItemClick = (action) => {
    setOpenMenu(null);
    onAction?.(action);
  };

  return (
    <div
      ref={barRef}
      className="h-8 bg-gh-canvas border-b border-gh-border flex items-center px-2 gap-1 select-none shrink-0 z-40"
    >
      {/* App logo mark */}
      <div className="flex items-center gap-1.5 px-2 mr-1">
        <div className="w-5 h-5 rounded bg-gh-accentEmphasis flex items-center justify-center">
          <Zap size={11} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[11px] font-semibold text-gh-textMuted tracking-wide">VistA</span>
      </div>

      {/* Menu items */}
      {MENUS.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
            onMouseEnter={() => openMenu && openMenu !== menu.id && setOpenMenu(menu.id)}
            className={`px-2.5 py-1 rounded text-[12px] transition-colors ${
              openMenu === menu.id
                ? 'bg-gh-surface text-gh-text'
                : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-surface/60'
            }`}
          >
            {menu.label}
          </button>

          {/* Dropdown */}
          {openMenu === menu.id && (
            <div className="absolute top-full left-0 mt-0.5 w-56 bg-gh-canvas border border-gh-border rounded-lg shadow-modal py-1 z-50 animate-fadeInScale">
              {menu.items.map((item, i) =>
                item.divider ? (
                  <div key={i} className="my-1 border-t border-gh-border" />
                ) : (
                  <button
                    key={i}
                    onClick={() => handleItemClick(item.action)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-gh-textMuted hover:text-gh-text hover:bg-gh-surface transition-colors text-left"
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="text-[10px] text-gh-textSubtle font-mono ml-4 shrink-0">{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}

      {/* Ellipsis for overflow */}
      <button className="px-2 py-1 rounded text-[12px] text-gh-textSubtle hover:text-gh-text hover:bg-gh-surface/60 transition-colors">
        ···
      </button>
    </div>
  );
}
