import React, { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { CheckCircle, XCircle, RotateCcw, Columns, Monitor, Code2, ArrowRight, Zap } from 'lucide-react';

export default function MonacoEditorTab({
  activeRoutine,
  conversion,
  targetLang,
  reviewDecision,
  onApprove,
  onReject,
  onRollback,
  isProcessing,
  pipelineStep,
  pipelineProgress,
}) {
  const [viewMode, setViewMode] = useState('split');
  // splitRatio: fraction of total width given to the left (MUMPS) pane. 0–1.
  const [splitRatio, setSplitRatio] = useState(0.5);
  const editorAreaRef = useRef(null);
  const isDragging = useRef(false);

  const mumpsCode = activeRoutine?.raw_code || '; No routine selected\n; Upload a file and click "Run Pipeline" to begin';
  const targetCode = conversion?.generated_code || (
    isProcessing
      ? `# Pipeline running: ${pipelineStep || 'Processing…'}\n# Please wait…`
      : `# Waiting for pipeline execution\n# 1. Upload a MUMPS/COBOL file from the Explorer\n# 2. Select target language (Python or R)\n# 3. Click "Run Pipeline" to transform the code\n# 4. AI will analyze, convert and verify your code`
  );

  const langMap = { Python: 'python', R: 'r' };
  const targetMonacoLang = langMap[targetLang] || 'python';

  const isReverted = reviewDecision?.decision === 'reverted';
  const isApproved = reviewDecision?.decision === 'approved';
  const isRejected = reviewDecision?.decision === 'rejected';

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

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-bg overflow-hidden">
      {/* Tab Header */}
      <div className="bg-gh-canvas border-b border-gh-border flex justify-between items-center px-3 h-10 shrink-0">
        <div className="flex items-center gap-2">
          {/* File tab pill */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gh-bg border-b-2 border-gh-accent text-xs text-gh-text font-medium rounded-t">
            <Code2 size={13} className="text-gh-orange" />
            <span className="font-mono">{activeRoutine ? `${activeRoutine.name}.m` : 'No file'}</span>
            <ArrowRight size={11} className="text-gh-textSubtle" />
            <span className="text-gh-green font-semibold">{targetLang}</span>
          </div>

          {/* Review badge */}
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
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-gh-bg border border-gh-border rounded-lg overflow-hidden text-xs">
            {[
              { id: 'split', icon: Columns, label: 'Split' },
              { id: 'source', icon: Code2, label: 'Source' },
              { id: 'target', icon: Monitor, label: targetLang },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`flex items-center gap-1 px-2.5 py-1 transition-colors ${
                  viewMode === id
                    ? 'bg-gh-accent text-white'
                    : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-surface/50'
                }`}
              >
                <Icon size={12} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Review Actions */}
          {!isReverted && (
            <div className="flex items-center gap-1 pl-2 border-l border-gh-border">
              <button
                onClick={onApprove}
                title="Approve conversion"
                disabled={!conversion}
                className="flex items-center gap-1 px-2.5 py-1 bg-gh-greenBg hover:bg-gh-green/20 text-gh-green border border-gh-greenDim/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              >
                <CheckCircle size={12} />
                Approve
              </button>
              <button
                onClick={onReject}
                title="Reject conversion"
                disabled={!conversion}
                className="flex items-center gap-1 px-2.5 py-1 bg-gh-redBg hover:bg-gh-red/20 text-gh-red border border-gh-red/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              >
                <XCircle size={12} />
                Reject
              </button>
              <button
                onClick={onRollback}
                title="Rollback to legacy"
                disabled={!conversion}
                className="flex items-center gap-1 px-2.5 py-1 bg-gh-surface hover:bg-gh-surface2 text-gh-textMuted border border-gh-border rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              >
                <RotateCcw size={12} />
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
      <div ref={editorAreaRef} className="flex-1 flex overflow-hidden">

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
                VistA Dialect
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
                    <span className="w-2 h-2 rounded-full bg-gh-green shrink-0" />
                    <span className="text-xs font-mono text-gh-textMuted font-semibold">
                      {targetLang} — AI Generated
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
              {conversion && (
                <span className="text-[10px] font-mono text-gh-green px-1.5 py-0.5 bg-gh-greenBg rounded border border-gh-greenDim/20 flex items-center gap-1">
                  <Zap size={9} />
                  AI Generated
                </span>
              )}
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
    </div>
  );
}
