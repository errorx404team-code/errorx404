import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  CheckCircle, XCircle, RotateCcw, Columns, Monitor, Code2, Zap,
  X, FolderOpen, FileUp, Upload, Terminal, Play, FileCode, AlertTriangle,
} from 'lucide-react';
import logoImg from '../assets/temp_image_1786523047062.jpeg';

// ── Confirmation Modal ────────────────────────────────────────────────────────

function ConfirmModal({ action, onConfirm, onCancel }) {
  const isAccept = action === 'approved';
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-gh-canvas border border-gh-border rounded-2xl w-full max-w-md shadow-modal animate-fadeInScale overflow-hidden">
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b border-gh-border ${isAccept ? 'bg-gh-greenBg/30' : 'bg-gh-redBg/30'}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAccept ? 'bg-gh-green/20 border border-gh-green/30' : 'bg-gh-red/20 border border-gh-red/30'}`}>
            <AlertTriangle size={18} className={isAccept ? 'text-gh-green' : 'text-gh-red'} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gh-text">
              {isAccept ? 'Accept Conversion?' : 'Reject Conversion?'}
            </h3>
            <p className="text-xs text-gh-textMuted mt-0.5">Verification required before continuing</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* Warning notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-gh-yellow/30 bg-gh-yellowBg/40">
            <AlertTriangle size={14} className="text-gh-yellow shrink-0 mt-0.5" />
            <p className="text-xs text-gh-textMuted leading-relaxed">
              <span className="font-semibold text-gh-text">Please verify before continuing.</span>
              {' '}Run and check the generated Python application in the terminal below before{' '}
              {isAccept ? 'accepting' : 'rejecting'} this conversion. This action will affect the generated output.
            </p>
          </div>

          {/* What will happen */}
          <div className="rounded-lg border border-gh-border bg-gh-surface/50 p-3">
            <p className="text-[11px] font-semibold text-gh-textMuted mb-2 uppercase tracking-wide">What happens next</p>
            <ul className="space-y-1.5">
              {isAccept ? (
                <>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <CheckCircle size={12} className="text-gh-green shrink-0" />
                    Conversion is marked <span className="font-semibold text-gh-green ml-1">approved</span>
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <CheckCircle size={12} className="text-gh-green shrink-0" />
                    Generated Python output is preserved
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <CheckCircle size={12} className="text-gh-green shrink-0" />
                    Project ZIP is downloaded automatically
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <XCircle size={12} className="text-gh-red shrink-0" />
                    Conversion is marked <span className="font-semibold text-gh-red ml-1">rejected</span>
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <XCircle size={12} className="text-gh-red shrink-0" />
                    Generated Python output is <span className="font-semibold text-gh-red mx-1">removed/invalidated</span>
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <CheckCircle size={12} className="text-gh-green shrink-0" />
                    Original MUMPS source is kept intact
                  </li>
                  <li className="flex items-center gap-2 text-xs text-gh-text">
                    <XCircle size={12} className="text-gh-red shrink-0" />
                    Rejected code will NOT be exported
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gh-border bg-gh-bg/40">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-text rounded-lg text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm ${
              isAccept
                ? 'bg-gh-green hover:bg-gh-green/90'
                : 'bg-gh-red hover:bg-gh-red/90'
            }`}
          >
            Continue — {isAccept ? 'Accept' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonacoEditorTab({
  openRoutines = [],
  activeRoutine,
  onSelectRoutine,
  onCloseTab,
  onOpenUploadModal,
  conversion,
  targetLang,
  reviewDecision,
  onApprove,
  onReject,
  onRollback,
  isProcessing,
  pipelineStep,
  pipelineProgress,
  onRunSinglePipeline,
  // Loading states from App.jsx
  isApproving,
  isRejecting,
}) {
  const [viewMode, setViewMode] = useState('split');
  const [splitRatio, setSplitRatio] = useState(0.5);
  const editorAreaRef = useRef(null);
  const isDragging = useRef(false);

  // Confirmation modal state
  const [pendingAction, setPendingAction] = useState(null); // 'approved' | 'rejected' | null

  // Terminal state — closed by default, lives in this component
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [termIsRunning, setTermIsRunning] = useState(false);
  const [termResult, setTermResult] = useState(null);
  const [termHasRun, setTermHasRun] = useState(false);
  const termOutputRef = useRef(null);

  // Auto-scroll terminal output
  useEffect(() => {
    if (termOutputRef.current) {
      termOutputRef.current.scrollTop = termOutputRef.current.scrollHeight;
    }
  }, [termResult, termIsRunning]);

  const handleRunApp = async () => {
    if (!conversion?.id || termIsRunning) return;
    setTermIsRunning(true);
    setTermResult(null);
    setTermHasRun(false);
    try {
      const res = await fetch(`/api/conversions/${conversion.id}/run`, { method: 'POST' });
      const data = res.ok
        ? await res.json()
        : { success: false, stdout: '', stderr: (await res.json().catch(() => ({}))).detail || 'Execution failed.', exit_code: 1, execution_time: 0 };
      setTermResult(data);
    } catch (e) {
      setTermResult({ success: false, stdout: '', stderr: `Network error: ${e.message}`, exit_code: 1, execution_time: 0 });
    } finally {
      setTermIsRunning(false);
      setTermHasRun(true);
    }
  };

  const mumpsCode = activeRoutine?.raw_code || '';
  const targetCode = conversion?.generated_code || (
    isProcessing
      ? `# Pipeline running: ${pipelineStep || 'Processing…'}\n# Please wait…`
      : `# Waiting for pipeline execution\n# 1. Select a routine from Explorer or Tabs\n# 2. Click "Run Pipeline" at top-right\n# 3. AI will analyze, convert and verify your code`
  );

  const langMap = { Python: 'python', R: 'r' };
  const targetMonacoLang = langMap[targetLang] || 'python';

  const isReverted = reviewDecision?.decision === 'reverted';
  const isApproved = reviewDecision?.decision === 'approved';
  const isRejected = reviewDecision?.decision === 'rejected';
  const hasDecision = isApproved || isRejected;

  // ── Draggable gutter ───────────────────────────────────────────────────────

  const onMouseDownGutter = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (ev) => {
      if (!isDragging.current || !editorAreaRef.current) return;
      const rect = editorAreaRef.current.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // ── Review button click handlers ──────────────────────────────────────────

  const handleApproveClick = () => {
    if (hasDecision || !conversion || isApproving || isRejecting) return;
    setPendingAction('approved');
  };

  const handleRejectClick = () => {
    if (hasDecision || !conversion || isApproving || isRejecting) return;
    setPendingAction('rejected');
  };

  const handleConfirm = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'approved') onApprove?.();
    else if (action === 'rejected') onReject?.();
  };

  const handleCancel = () => {
    setPendingAction(null);
  };

  // ── VS Code Welcome Screen View ───────────────────────────────────────────

  if (!activeRoutine) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gh-bg overflow-hidden items-center justify-center p-8 select-none">
        <div className="max-w-2xl w-full flex flex-col items-center text-center gap-6 animate-fadeIn">
          {/* Logo Mark */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-white/10">
            <img src={logoImg} alt="ErrorX404" className="w-full h-full object-cover" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gh-text tracking-tight">Welcome to ErrorX404</h1>
            <p className="text-sm text-gh-textMuted mt-1">
              AI-Powered Legacy Code Transformation Engine — MUMPS &amp; COBOL to Python 3.11+ / R
            </p>
          </div>

          {/* Quick Actions Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mt-2">
            <button
              onClick={() => onOpenUploadModal?.('folder')}
              className="p-4 bg-gh-canvas hover:bg-gh-surface border border-gh-border hover:border-gh-accent rounded-xl flex items-center gap-3.5 text-left transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-gh-accent/10 border border-gh-accent/20 flex items-center justify-center group-hover:bg-gh-accent/20 shrink-0">
                <FolderOpen size={20} className="text-gh-accent" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gh-text group-hover:text-gh-accent transition-colors">Open Folder</h3>
                <p className="text-[11px] text-gh-textSubtle mt-0.5">Select a folder of MUMPS routines</p>
              </div>
            </button>

            <button
              onClick={() => onOpenUploadModal?.('file')}
              className="p-4 bg-gh-canvas hover:bg-gh-surface border border-gh-border hover:border-gh-accent rounded-xl flex items-center gap-3.5 text-left transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-gh-green/10 border border-gh-green/20 flex items-center justify-center group-hover:bg-gh-green/20 shrink-0">
                <FileUp size={20} className="text-gh-green" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gh-text group-hover:text-gh-green transition-colors">Open Files</h3>
                <p className="text-[11px] text-gh-textSubtle mt-0.5">Browse single or multiple .m files</p>
              </div>
            </button>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onClick={() => onOpenUploadModal?.('file')}
            className="w-full max-w-lg p-6 border-2 border-dashed border-gh-border hover:border-gh-accent rounded-2xl bg-gh-canvas/50 hover:bg-gh-surface/30 cursor-pointer flex flex-col items-center gap-2 transition-all"
          >
            <Upload size={22} className="text-gh-textSubtle" />
            <p className="text-xs text-gh-textMuted font-medium">Or drag and drop files / folders anywhere into the Explorer sidebar</p>
            <span className="text-[10px] text-gh-textSubtle">Supports .m, .mps, .txt, .mumps, .rou, .cob, .cbl</span>
          </div>
        </div>
      </div>
    );
  }

  const isActionsLoading = isApproving || isRejecting;

  return (
    <>
      {/* Confirmation Modal (portal-level overlay) */}
      {pendingAction && (
        <ConfirmModal
          action={pendingAction}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      <div className="flex-1 flex flex-col h-full bg-gh-bg overflow-hidden">
        {/* VS Code File Tabs Header */}
        <div className="bg-gh-canvas border-b border-gh-border flex justify-between items-center px-1 h-9 shrink-0 overflow-x-auto">
          {/* Open Routine Tabs */}
          <div className="flex items-center gap-0.5 overflow-x-auto h-full scrollbar-none">
            {openRoutines.map((routine) => {
              const isActive = routine.id === activeRoutine.id;
              return (
                <div
                  key={routine.id}
                  onClick={() => onSelectRoutine?.(routine)}
                  className={`group h-full flex items-center gap-2 px-3 py-1 text-xs font-mono border-r border-gh-border cursor-pointer select-none transition-colors ${
                    isActive
                      ? 'bg-gh-bg text-gh-text border-t-2 border-t-gh-accent font-semibold'
                      : 'bg-gh-canvas text-gh-textMuted hover:bg-gh-surface hover:text-gh-text'
                  }`}
                >
                  <FileCode size={13} className={isActive ? 'text-gh-orange' : 'text-gh-textSubtle'} />
                  <span className="truncate max-w-[140px]">{routine.name}.m</span>
                  {onCloseTab && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(routine.id);
                      }}
                      className="w-4 h-4 rounded hover:bg-gh-surface2 flex items-center justify-center text-gh-textSubtle hover:text-gh-text transition-colors opacity-70 group-hover:opacity-100 ml-1"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* View Mode and Review Action Controls */}
          <div className="flex items-center gap-2 px-2 shrink-0">
            {/* Review status badges */}
            {isApproved && (
              <span className="badge bg-gh-greenBg text-gh-green border border-gh-greenDim/40 animate-fadeIn">
                ✓ Approved
              </span>
            )}
            {isRejected && (
              <span className="badge bg-gh-redBg text-gh-red border border-gh-red/20 animate-fadeIn">
                ✗ Rejected
              </span>
            )}
            {isReverted && (
              <span className="badge bg-gh-yellowBg text-gh-yellow border border-gh-yellow/30 animate-fadeIn">
                ↩ Reverted
              </span>
            )}

            {/* View mode toggle */}
            <div className="flex items-center bg-gh-bg border border-gh-border rounded-md overflow-hidden text-xs">
              {[
                { id: 'split', icon: Columns, label: 'Split' },
                { id: 'source', icon: Code2, label: 'Source' },
                { id: 'target', icon: Monitor, label: targetLang },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-1 px-2 py-0.5 transition-colors ${
                    viewMode === id
                      ? 'bg-gh-accent text-white font-medium'
                      : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-surface/50'
                  }`}
                >
                  <Icon size={11} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Terminal toggle button — in header, next to view controls */}
            <button
              onClick={() => setIsTerminalOpen(v => !v)}
              title={isTerminalOpen ? 'Close terminal' : 'Open application terminal'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium transition-colors ${
                isTerminalOpen
                  ? 'bg-gh-accent/15 text-gh-accent border-gh-accent/30'
                  : 'bg-gh-bg text-gh-textMuted border-gh-border hover:text-gh-text hover:border-gh-accent/40'
              }`}
            >
              <Terminal size={11} />
              <span>Terminal</span>
              {termHasRun && termResult && (
                <span className={`ml-0.5 w-1.5 h-1.5 rounded-full ${termResult.success ? 'bg-gh-green' : 'bg-gh-red'}`} />
              )}
            </button>

            {/* Review Actions */}
            {!isReverted && (
              <div className="flex items-center gap-1 pl-2 border-l border-gh-border">
                {/* Accept button */}
                <button
                  onClick={handleApproveClick}
                  title={hasDecision ? `Already ${isApproved ? 'approved' : 'rejected'}` : 'Accept conversion — verify in terminal first'}
                  disabled={!conversion || hasDecision || isActionsLoading}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-40 ${
                    isApproved
                      ? 'bg-gh-green/20 text-gh-green border border-gh-greenDim/30 cursor-not-allowed'
                      : 'bg-gh-greenBg hover:bg-gh-green/20 text-gh-green border border-gh-greenDim/30'
                  }`}
                >
                  {isApproving ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Accepting…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={11} />
                      {isApproved ? 'Accepted' : 'Accept'}
                    </>
                  )}
                </button>

                {/* Reject button */}
                <button
                  onClick={handleRejectClick}
                  title={hasDecision ? `Already ${isApproved ? 'approved' : 'rejected'}` : 'Reject conversion — verify in terminal first'}
                  disabled={!conversion || hasDecision || isActionsLoading}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-40 ${
                    isRejected
                      ? 'bg-gh-red/20 text-gh-red border border-gh-red/20 cursor-not-allowed'
                      : 'bg-gh-redBg hover:bg-gh-red/20 text-gh-red border border-gh-red/20'
                  }`}
                >
                  {isRejecting ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Rejecting…
                    </>
                  ) : (
                    <>
                      <XCircle size={11} />
                      {isRejected ? 'Rejected' : 'Reject'}
                    </>
                  )}
                </button>

                {/* Rollback button */}
                <button
                  onClick={onRollback}
                  title="Rollback to legacy"
                  disabled={!conversion || isActionsLoading}
                  className="flex items-center gap-1 px-2 py-0.5 bg-gh-surface hover:bg-gh-surface2 text-gh-textMuted border border-gh-border rounded text-xs font-medium transition-colors disabled:opacity-40"
                >
                  <RotateCcw size={11} />
                  Rollback
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline progress inline bar */}
        {isProcessing && (
          <div className="h-0.5 bg-gh-surface shrink-0">
            <div
              className="h-full bg-gradient-to-r from-gh-accent to-gh-purple transition-all duration-700"
              style={{ width: `${pipelineProgress}%` }}
            />
          </div>
        )}

        {/* Editor Area */}
        <div ref={editorAreaRef} className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Left pane: MUMPS source ── */}
          {(viewMode === 'split' || viewMode === 'source') && (
            <div
              className="flex flex-col overflow-hidden"
              style={{
                width: viewMode === 'split' ? `${splitRatio * 100}%` : '100%',
                borderRight: viewMode === 'split' ? '1px solid #30363d' : 'none',
              }}
            >
              <div className="px-3 py-1.5 border-b border-gh-border bg-gh-surface2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gh-yellow shrink-0" />
                  <span className="text-xs font-mono text-gh-textMuted font-semibold">
                    {activeRoutine?.name || 'LEGACY'} — MUMPS Source
                  </span>
                </div>
                <span className="text-[10px] font-mono text-gh-yellow px-1.5 py-0.5 bg-gh-yellowBg rounded border border-gh-yellow/20">
                  MUMPS Dialect
                </span>
              </div>
              <div className="flex-1">
                <Editor
                  height="100%"
                  defaultLanguage="apex"
                  theme="vs-dark"
                  value={mumpsCode}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    padding: { top: 8 },
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Draggable gutter (split view only) ── */}
          {viewMode === 'split' && (
            <div
              onMouseDown={onMouseDownGutter}
              title="Drag to resize"
              className="w-1 shrink-0 bg-gh-border hover:bg-gh-accent cursor-col-resize transition-colors relative group"
            >
              {/* Grip dots */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col justify-center gap-1 opacity-0 group-hover:opacity-70 pointer-events-none">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full bg-white" />
                ))}
              </div>
            </div>
          )}

          {/* ── Right pane: target language ── */}
          {(viewMode === 'split' || viewMode === 'target') && (
            <div
              className="flex flex-col overflow-hidden"
              style={{
                width: viewMode === 'split' ? `${(1 - splitRatio) * 100}%` : '100%',
              }}
            >
              <div className="px-3 py-1.5 border-b border-gh-border bg-gh-surface2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {conversion ? (
                    <>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isRejected ? 'bg-gh-red' : 'bg-gh-green'}`} />
                      <span className="text-xs font-mono text-gh-textMuted font-semibold">
                        {targetLang} — {isRejected ? 'Rejected (invalidated)' : 'AI Converted'}
                      </span>
                    </>
                  ) : isProcessing ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2" className="animate-spin shrink-0">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      <span className="text-xs font-mono text-gh-accent font-semibold">{pipelineStep || 'Processing…'}</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-gh-textSubtle shrink-0" />
                      <span className="text-xs font-mono text-gh-textMuted font-semibold">
                        {targetLang} — Waiting for Pipeline
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Conversion source badge — shows REAL AI vs DEMO vs unknown */}
                  {conversion && !isRejected && (() => {
                    const src = conversion.conversion_source;
                    if (src === 'REAL_GEMINI') {
                      return (
                        <span className="text-[10px] font-mono text-gh-green px-1.5 py-0.5 bg-gh-greenBg rounded border border-gh-greenDim/20 flex items-center gap-1">
                          <Zap size={9} />
                          REAL AI CONVERSION
                        </span>
                      );
                    }
                    if (src === 'DEMO_FALLBACK') {
                      return (
                        <span className="text-[10px] font-mono text-gh-yellow px-1.5 py-0.5 bg-gh-yellowBg rounded border border-gh-yellow/30 flex items-center gap-1">
                          ⚠ DEMO FALLBACK — Configure API Key
                        </span>
                      );
                    }
                    if (src === 'FAILED') {
                      return (
                        <span className="text-[10px] font-mono text-gh-red px-1.5 py-0.5 bg-gh-redBg rounded border border-gh-red/20 flex items-center gap-1">
                          ✗ CONVERSION FAILED
                        </span>
                      );
                    }
                    // Unknown / legacy record — show neutral badge
                    return (
                      <span className="text-[10px] font-mono text-gh-textMuted px-1.5 py-0.5 bg-gh-surface2 rounded border border-gh-border flex items-center gap-1">
                        <Zap size={9} />
                        AI Converted
                      </span>
                    );
                  })()}
                  {!conversion && !isProcessing && onRunSinglePipeline && (
                    <button
                      onClick={onRunSinglePipeline}
                      className="px-2.5 py-1 bg-gh-accent hover:bg-gh-accentHover text-white rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Play size={10} fill="currentColor" className="shrink-0" />
                      Run Single Routine
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <Editor
                  height="100%"
                  defaultLanguage={targetMonacoLang}
                  language={targetMonacoLang}
                  theme="vs-dark"
                  value={targetCode}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderLineHighlight: 'line',
                    padding: { top: 8 },
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Application Terminal Panel ── */}
        {isTerminalOpen && (
          <div className="border-t border-gh-border bg-gh-bg shrink-0 flex flex-col" style={{ height: 220 }}>
            {/* Terminal inner header */}
            <div className="flex items-center justify-between px-3 h-7 bg-gh-canvas border-b border-gh-border shrink-0 select-none">
              <div className="flex items-center gap-2">
                <Terminal size={11} className="text-gh-textSubtle" />
                <span className="text-[10px] font-semibold text-gh-textMuted uppercase tracking-wide">Application Terminal</span>
                {termHasRun && termResult && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    termResult.success
                      ? 'bg-gh-greenBg text-gh-green border border-gh-greenDim/30'
                      : 'bg-gh-redBg text-gh-red border border-gh-red/20'
                  }`}>
                    {termResult.success ? `exit 0 ✓ ${termResult.execution_time}s` : `exit ${termResult.exit_code} ✗`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Run Application button */}
                <button
                  onClick={handleRunApp}
                  disabled={!conversion?.id || termIsRunning}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 bg-gh-accent hover:bg-gh-accentHover text-white rounded text-[10px] font-semibold transition-colors disabled:opacity-40 shadow-sm"
                >
                  {termIsRunning ? (
                    <>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Running…
                    </>
                  ) : (
                    <>
                      <Play size={9} fill="currentColor" className="shrink-0" />
                      Run Application
                    </>
                  )}
                </button>
                {/* Close terminal */}
                <button
                  onClick={() => setIsTerminalOpen(false)}
                  className="w-5 h-5 rounded flex items-center justify-center text-gh-textSubtle hover:text-gh-text hover:bg-gh-surface transition-colors"
                  title="Close terminal"
                >
                  <X size={11} />
                </button>
              </div>
            </div>

            {/* Output area */}
            <div
              ref={termOutputRef}
              className="flex-1 overflow-y-auto p-3 text-[11px] leading-relaxed bg-gh-bg"
              style={{ fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace" }}
            >
              {!termHasRun && !termIsRunning && (
                <div className="flex flex-col gap-1 text-gh-textSubtle">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gh-green select-none">▸</span>
                    <span>ErrorX404 Application Terminal — sandboxed Python executor</span>
                  </div>
                  <div className="mt-1 opacity-60">
                    Click <span className="text-gh-accent font-semibold">Run Application</span> to execute the generated Python code and inspect the output before making a review decision.
                  </div>
                  <div className="mt-2 opacity-50 text-[10px]">
                    Workflow: Generate → <span className="text-gh-yellow">Run in Terminal</span> → Inspect → Accept / Reject
                  </div>
                </div>
              )}

              {termIsRunning && (
                <div className="flex items-center gap-2 text-gh-accent">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <span>Executing in sandboxed subprocess…</span>
                </div>
              )}

              {termHasRun && termResult && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-gh-textSubtle mb-0.5">
                    <span className="text-gh-green select-none">$</span>
                    <span>python conversion_{conversion?.id}.py</span>
                  </div>
                  {termResult.stdout && (
                    <pre className="whitespace-pre-wrap text-gh-text break-words">{termResult.stdout}</pre>
                  )}
                  {termResult.stderr && (
                    <pre className="whitespace-pre-wrap text-gh-red break-words">{termResult.stderr}</pre>
                  )}
                  <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-semibold ${termResult.success ? 'text-gh-green' : 'text-gh-red'}`}>
                    {termResult.success ? <CheckCircle size={10} /> : <XCircle size={10} />}
                    <span>Process exited with code {termResult.exit_code} — {termResult.success ? 'SUCCESS' : 'FAILURE'} ({termResult.execution_time}s)</span>
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-gh-border/40 text-[10px] text-gh-textSubtle opacity-60">
                    {termResult.success
                      ? '✓ Application ran successfully. Accept or Reject this conversion.'
                      : '✗ Errors detected. Review stderr above, then decide whether to Accept or Reject.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
