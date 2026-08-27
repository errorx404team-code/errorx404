import React, { useState, useEffect, useRef } from 'react';
import logoImg from '../assets/temp_image_1786523047062.jpeg';

// ─── Menu definitions ────────────────────────────────────────────────────────

const MENUS = [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: 'Upload File…',       shortcut: 'Ctrl+O',    action: 'upload-file' },
      { label: 'Upload Folder…',     shortcut: 'Ctrl+Shift+O', action: 'upload-folder' },
      { divider: true },
      { label: 'Export Active File…', shortcut: 'Ctrl+Shift+S', action: 'export' },
      { label: 'Export Project ZIP…', shortcut: 'Ctrl+Shift+Z', action: 'export-project' },
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

export default function MenuBar({
  onAction,
  activeRoutine,
  targetLang,
  setTargetLang,
  isProcessing,
  pipelineStep,
  pipelineProgress,
  onRunPipeline,
  totalRoutines = 0,
}) {
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

  const canRun = !isProcessing && totalRoutines > 0;

  return (
    <div
      ref={barRef}
      className="h-9 bg-gh-canvas border-b border-gh-border flex items-center justify-between px-3 select-none shrink-0 z-40"
    >
      <div className="flex items-center gap-1.5">
        {/* App logo mark */}
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-gh-border">
          <img
            src={logoImg}
            alt="ErrorX404"
            className="w-6 h-6 rounded-md object-contain"
          />
          <span className="text-xs font-semibold text-gh-text tracking-wide">ErrorX404</span>
        </div>

        {/* Menu items */}
        {MENUS.map((menu) => (
          <div key={menu.id} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
              onMouseEnter={() => openMenu && openMenu !== menu.id && setOpenMenu(menu.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
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
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gh-textMuted hover:text-gh-text hover:bg-gh-surface transition-colors text-left"
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
      </div>

      {/* Right Controls: Target Language Selector + Run Pipeline Button */}
      <div className="flex items-center gap-3">
        {/* Target Language Dropdown */}
        {setTargetLang && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gh-textSubtle font-medium hidden sm:inline">Target:</span>
            <select
              value={targetLang || 'Python'}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-gh-surface border border-gh-border rounded-md px-2 py-0.5 text-xs text-gh-text focus:outline-none focus:border-gh-accent font-medium cursor-pointer"
            >
              <option value="Python">Python 3.11+</option>
              <option value="R">R Language</option>
            </select>
          </div>
        )}

        {/* Top-Right Run Pipeline Button */}
        <div className="flex items-center gap-2">
          {isProcessing && pipelineProgress > 0 && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-gh-textSubtle font-mono">
              <span>{pipelineProgress}%</span>
              <div className="w-20 h-1.5 bg-gh-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-gh-accent rounded-full transition-all duration-300"
                  style={{ width: `${pipelineProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={onRunPipeline}
            disabled={!canRun}
            title={totalRoutines > 0 ? 'Run modernization pipeline for all project files' : 'Upload some routines first'}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              canRun
                ? 'bg-gh-accent hover:bg-gh-accentHover text-white'
                : isProcessing
                ? 'bg-gh-accentEmphasis text-white cursor-not-allowed'
                : 'bg-gh-surface text-gh-textSubtle cursor-not-allowed border border-gh-border opacity-50'
            }`}
          >
            {isProcessing ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span className="truncate max-w-[140px]">{pipelineStep || 'Running…'}</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>Run Pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
