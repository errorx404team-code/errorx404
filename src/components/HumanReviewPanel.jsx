import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, RotateCcw, MessageSquare,
  ShieldCheck, FileCode, Check, Copy, Download, RefreshCw,
  Eye, BookOpen, Activity, FileText, ChevronRight, ChevronDown,
  Layers, Terminal, HelpCircle, UserCheck, AlertCircle, Info, Sparkles
} from 'lucide-react';

export default function HumanReviewPanel({
  activeRoutine,
  conversion,
  verificationData,
  confidenceData,
  documentationData,
  explainabilityData,
  reviewDecision,
  onReview,
  onRollback,
  onApprove,
  onReject,
  showToast,
  isProcessing = false,
}) {
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('code'); // 'code' | 'verification' | 'confidence' | 'docs' | 'explainability'
  const [codeViewMode, setCodeViewMode] = useState('split'); // 'split' | 'source' | 'target'
  const [copiedSection, setCopiedSection] = useState(null);

  // Sync reviewer notes when reviewDecision changes
  useEffect(() => {
    if (reviewDecision?.reviewer_notes) {
      setReviewerNotes(reviewDecision.reviewer_notes);
    }
  }, [reviewDecision]);

  const score = confidenceData?.score ?? confidenceData?.confidence_score ?? 0;
  const verStatus = verificationData?.verification_status || verificationData?.status || 'NOT_VERIFIED';
  const isVerified = verStatus === 'VERIFIED' || verStatus === 'PASSED';

  // AI Suggested Status calculation (Requirement 9)
  const getAISuggestedStatus = (val) => {
    if (val >= 85) {
      return {
        label: 'Safe',
        badgeClass: 'bg-gh-greenBg text-gh-green border-gh-greenDim/30',
        dotClass: 'bg-gh-green',
        recommendation: 'Confidence ≥ 85% — recommended for immediate approval',
        icon: CheckCircle2,
      };
    }
    if (val >= 50) {
      return {
        label: 'Needs Review',
        badgeClass: 'bg-gh-yellowBg text-gh-yellow border-gh-yellow/30',
        dotClass: 'bg-gh-yellow',
        recommendation: 'Confidence 50%–84% — manual code & test inspection advised',
        icon: AlertTriangle,
      };
    }
    return {
      label: 'Failed',
      badgeClass: 'bg-gh-redBg text-gh-red border-gh-red/20',
      dotClass: 'bg-gh-red',
      recommendation: 'Confidence < 50% — manual refactoring or rejection required',
      icon: XCircle,
    };
  };

  const aiSuggestion = getAISuggestedStatus(score);

  const handleCopy = (text, section) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
    showToast?.('Copied to clipboard', 'info');
  };

  // Submit Review Actions
  const handleAction = async (decision) => {
    if (!conversion || isSubmitting) return;
    setIsSubmitting(true);
    setSubmittingAction(decision);

    try {
      if (decision === 'approved') {
        if (onApprove) {
          await onApprove();
        } else if (onReview) {
          await onReview('approved', reviewerNotes || 'Accepted via Human Review Panel');
        }
      } else if (decision === 'rejected') {
        if (onReject) {
          await onReject();
        } else if (onReview) {
          await onReview('rejected', reviewerNotes || 'Rejected via Human Review Panel');
        }
      } else if (decision === 'reverted') {
        if (onRollback) {
          await onRollback(reviewerNotes || 'Rolled back to original legacy routine');
        } else if (onReview) {
          await onReview('reverted', reviewerNotes || 'Rolled back to original legacy routine');
        }
      } else {
        // 'changes_requested'
        if (onReview) {
          await onReview('changes_requested', reviewerNotes || 'Changes requested by reviewer');
        } else {
          const res = await fetch(`/api/conversions/${conversion.id}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              decision: 'changes_requested',
              reviewer_notes: reviewerNotes || 'Changes requested by reviewer',
            }),
          });
          if (res.ok) {
            showToast?.('Changes requested successfully', 'success');
          } else {
            throw new Error('Failed to record review');
          }
        }
      }
    } catch (e) {
      showToast?.(`Review action failed: ${e.message}`, 'error');
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  };

  const quickNotes = [
    'Business rules 100% preserved',
    'All verification tests passed with valid output',
    'Edge cases need additional test coverage',
    'Variable mappings verified against MUMPS globals',
    'Minor performance optimization needed',
  ];

  if (!activeRoutine) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gh-bg text-center text-gh-textSubtle select-none">
        <UserCheck size={36} className="text-gh-accent mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-gh-text">Human-in-the-Loop Review</h3>
        <p className="text-xs text-gh-textMuted max-w-sm mt-1">
          Select an uploaded routine from the Explorer to inspect conversion quality, review verification results, and submit your decision.
        </p>
      </div>
    );
  }

  const currentDecision = reviewDecision?.decision;

  return (
    <div className="flex-1 flex flex-col h-full bg-gh-bg overflow-hidden text-gh-text select-none animate-fadeIn">
      {/* ── Top Header & Status Bar ───────────────────────────────────────── */}
      <div className="bg-gh-canvas border-b border-gh-border p-4 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gh-accent/10 border border-gh-accent/20 flex items-center justify-center text-gh-accent">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gh-text font-mono">{activeRoutine.name}.m</h2>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gh-surface border border-gh-border text-gh-textMuted">
                {activeRoutine.source_language || 'MUMPS'} → {conversion?.target_language || 'Python'}
              </span>
              {conversion?.id && (
                <span className="text-[10px] text-gh-textSubtle font-mono">
                  #conv-{conversion.id}
                </span>
              )}
            </div>
            <p className="text-xs text-gh-textSubtle mt-0.5 flex items-center gap-2">
              <span>{activeRoutine.relative_path || `${activeRoutine.name}.m`}</span>
              {conversion?.model_used && (
                <span>· Engine: <strong className="text-gh-textMuted">{conversion.model_used}</strong></span>
              )}
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* AI Recommendation */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gh-surface border border-gh-border text-xs">
            <span className="text-gh-textSubtle text-[11px]">AI Suggestion:</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${aiSuggestion.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${aiSuggestion.dotClass}`} />
              {aiSuggestion.label} ({score}%)
            </span>
          </div>

          {/* Current Human Review Status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gh-surface border border-gh-border text-xs">
            <span className="text-gh-textSubtle text-[11px]">Human Decision:</span>
            {currentDecision === 'approved' ? (
              <span className="badge bg-gh-greenBg text-gh-green border border-gh-greenDim/40 font-semibold">
                ✓ Approved
              </span>
            ) : currentDecision === 'rejected' ? (
              <span className="badge bg-gh-redBg text-gh-red border border-gh-red/30 font-semibold">
                ✗ Rejected
              </span>
            ) : currentDecision === 'changes_requested' ? (
              <span className="badge bg-gh-yellowBg text-gh-yellow border border-gh-yellow/30 font-semibold">
                ✎ Changes Requested
              </span>
            ) : currentDecision === 'reverted' ? (
              <span className="badge bg-gh-purpleBg text-gh-purple border border-gh-purple/30 font-semibold">
                ↩ Reverted
              </span>
            ) : (
              <span className="badge bg-gh-surface2 text-gh-textMuted border border-gh-border font-semibold">
                ⏳ Pending Review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content Area: Split Review Layout ────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Code & Analysis Inspection Panes */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gh-border overflow-hidden">
          {/* Navigation Sub-Tabs */}
          <div className="bg-gh-surface border-b border-gh-border flex items-center justify-between px-3 h-9 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {[
                { id: 'code', label: 'Code Comparison', icon: FileCode },
                { id: 'verification', label: 'Verification Suite', icon: CheckCircle2, count: verificationData?.total_tests },
                { id: 'confidence', label: 'Confidence Breakdown', icon: ShieldCheck, badge: `${score}%` },
                { id: 'docs', label: 'Migration Docs', icon: FileText },
                { id: 'explainability', label: 'Explainability Trace', icon: Activity },
              ].map(({ id, label, icon: Icon, count, badge }) => (
                <button
                  key={id}
                  onClick={() => setActiveSubTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeSubTab === id
                      ? 'border-gh-accent text-gh-text bg-gh-canvas'
                      : 'border-transparent text-gh-textSubtle hover:text-gh-textMuted'
                  }`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-gh-surface2 border border-gh-border text-gh-textMuted font-mono">
                      {count}
                    </span>
                  )}
                  {badge && (
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                      score >= 85 ? 'bg-gh-greenBg text-gh-green' : score >= 50 ? 'bg-gh-yellowBg text-gh-yellow' : 'bg-gh-redBg text-gh-red'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Code View Mode toggle (when on Code tab) */}
            {activeSubTab === 'code' && (
              <div className="flex items-center bg-gh-canvas border border-gh-border rounded-md overflow-hidden text-[10px]">
                {['split', 'source', 'target'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCodeViewMode(mode)}
                    className={`px-2 py-0.5 capitalize transition-colors ${
                      codeViewMode === mode
                        ? 'bg-gh-accent text-white font-medium'
                        : 'text-gh-textMuted hover:text-gh-text'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sub-Tab Contents */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* 1. CODE COMPARISON */}
            {activeSubTab === 'code' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-gh-textSubtle">
                  <span>Review original MUMPS routine alongside modernized Python implementation</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(activeRoutine.raw_code || '', 'mumps')}
                      className="flex items-center gap-1 text-[11px] text-gh-textMuted hover:text-gh-text"
                    >
                      {copiedSection === 'mumps' ? <Check size={12} className="text-gh-green" /> : <Copy size={12} />}
                      Copy MUMPS
                    </button>
                    <button
                      onClick={() => handleCopy(conversion?.generated_code || '', 'python')}
                      className="flex items-center gap-1 text-[11px] text-gh-textMuted hover:text-gh-text"
                    >
                      {copiedSection === 'python' ? <Check size={12} className="text-gh-green" /> : <Copy size={12} />}
                      Copy Python
                    </button>
                  </div>
                </div>

                <div className={`flex-1 grid ${codeViewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'} gap-3 min-h-[360px]`}>
                  {(codeViewMode === 'split' || codeViewMode === 'source') && (
                    <div className="flex flex-col bg-gh-canvas border border-gh-border rounded-xl overflow-hidden">
                      <div className="px-3 py-1.5 bg-gh-surface border-b border-gh-border text-xs font-semibold text-gh-textMuted flex justify-between items-center">
                        <span>Original MUMPS Source</span>
                        <span className="text-[10px] text-gh-textSubtle font-mono">{(activeRoutine.raw_code || '').split('\n').length} lines</span>
                      </div>
                      <pre className="flex-1 p-3 text-xs font-mono overflow-auto text-gh-text leading-relaxed whitespace-pre bg-gh-canvas">
                        {activeRoutine.raw_code || '# No legacy MUMPS code found.'}
                      </pre>
                    </div>
                  )}

                  {(codeViewMode === 'split' || codeViewMode === 'target') && (
                    <div className="flex flex-col bg-gh-canvas border border-gh-border rounded-xl overflow-hidden">
                      <div className="px-3 py-1.5 bg-gh-surface border-b border-gh-border text-xs font-semibold text-gh-textMuted flex justify-between items-center">
                        <span>Modernized {conversion?.target_language || 'Python'} Code</span>
                        <span className="text-[10px] text-gh-textSubtle font-mono">{(conversion?.generated_code || '').split('\n').length} lines</span>
                      </div>
                      <pre className="flex-1 p-3 text-xs font-mono overflow-auto text-gh-green leading-relaxed whitespace-pre bg-gh-canvas">
                        {conversion?.generated_code || '# Conversion in progress or not yet run.\n# Click "Run Pipeline" to generate Python code.'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. VERIFICATION RESULTS */}
            {activeSubTab === 'verification' && (
              <div className="flex flex-col gap-4">
                {!verificationData ? (
                  <div className="p-8 text-center text-gh-textSubtle bg-gh-canvas border border-gh-border rounded-xl">
                    <Activity size={24} className="mx-auto mb-2 opacity-50 text-gh-accent" />
                    <p className="text-xs">No verification results available. Run the pipeline to execute the test suite.</p>
                  </div>
                ) : (
                  <>
                    {/* Verification KPI Cards */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 bg-gh-canvas border border-gh-border rounded-xl">
                        <span className="text-[11px] text-gh-textSubtle">Status</span>
                        <p className={`text-base font-bold mt-0.5 ${isVerified ? 'text-gh-green' : 'text-gh-red'}`}>
                          {verStatus}
                        </p>
                      </div>
                      <div className="p-3 bg-gh-canvas border border-gh-border rounded-xl">
                        <span className="text-[11px] text-gh-textSubtle">Total Tests</span>
                        <p className="text-base font-bold text-gh-text mt-0.5">{verificationData.total_tests}</p>
                      </div>
                      <div className="p-3 bg-gh-canvas border border-gh-border rounded-xl">
                        <span className="text-[11px] text-gh-textSubtle">Passed / Failed</span>
                        <p className="text-base font-bold mt-0.5">
                          <span className="text-gh-green">{verificationData.passed_tests}</span>
                          <span className="text-gh-textSubtle"> / </span>
                          <span className="text-gh-red">{verificationData.failed_tests}</span>
                        </p>
                      </div>
                      <div className="p-3 bg-gh-canvas border border-gh-border rounded-xl">
                        <span className="text-[11px] text-gh-textSubtle">Pass Rate</span>
                        <p className="text-base font-bold text-gh-accent mt-0.5">{verificationData.pass_rate}%</p>
                      </div>
                    </div>

                    {/* Detailed Test Cases Table */}
                    <div className="bg-gh-canvas border border-gh-border rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-gh-surface border-b border-gh-border text-xs font-semibold text-gh-text">
                        Independent Verification Test Cases
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="text-gh-textSubtle border-b border-gh-border bg-gh-surface/40">
                              <th className="p-2.5 font-semibold">Test ID</th>
                              <th className="p-2.5 font-semibold">Input Params</th>
                              <th className="p-2.5 font-semibold">Expected Output</th>
                              <th className="p-2.5 font-semibold">Actual Output</th>
                              <th className="p-2.5 font-semibold">Result</th>
                              <th className="p-2.5 font-semibold">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(verificationData.results || []).map((r, i) => {
                              const passed = r.passed || r.status === 'PASS';
                              return (
                                <tr key={i} className="border-b border-gh-border/60 hover:bg-gh-surface/40 font-mono text-[11px]">
                                  <td className="p-2.5 text-gh-textMuted">{r.test_id || r.test_case_id || i + 1}</td>
                                  <td className="p-2.5 text-gh-textSubtle truncate max-w-[160px]" title={r.input_json}>
                                    {r.input_json}
                                  </td>
                                  <td className="p-2.5 text-gh-text">{r.expected || r.expected_output}</td>
                                  <td className="p-2.5 text-gh-textMuted">{r.actual || r.actual_output || '—'}</td>
                                  <td className="p-2.5">
                                    {passed ? (
                                      <span className="badge bg-gh-greenBg text-gh-green border-gh-greenDim/30">
                                        PASS
                                      </span>
                                    ) : (
                                      <span className="badge bg-gh-redBg text-gh-red border-gh-red/20">
                                        {r.status || 'FAIL'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-gh-textSubtle text-[10px]" title={r.error || r.mismatch_details}>
                                    {r.error || r.mismatch_details || (passed ? 'Exact Match' : '—')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 3. CONFIDENCE SCORE BREAKDOWN */}
            {activeSubTab === 'confidence' && (
              <div className="flex flex-col gap-4">
                {!confidenceData ? (
                  <div className="p-8 text-center text-gh-textSubtle bg-gh-canvas border border-gh-border rounded-xl">
                    <ShieldCheck size={24} className="mx-auto mb-2 opacity-50 text-gh-accent" />
                    <p className="text-xs">Confidence calculation pending pipeline execution.</p>
                  </div>
                ) : (
                  <>
                    {/* Overall Score Header */}
                    <div className="p-4 bg-gh-canvas border border-gh-border rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gh-textSubtle uppercase tracking-wider font-semibold">
                          Confidence &amp; Hallucination Score
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-3xl font-extrabold text-gh-text">{score}%</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${aiSuggestion.badgeClass}`}>
                            {confidenceData.category || confidenceData.confidence_category || aiSuggestion.label}
                          </span>
                        </div>
                        <p className="text-xs text-gh-textMuted mt-1">
                          {confidenceData.reasoning_text || 'Mathematical confidence generated from verification pass rates and AST parsing.'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gh-textSubtle">Formula Weights</span>
                        <p className="text-xs text-gh-textMuted font-mono mt-0.5">
                          60% Pass Rate · 15% Syntax · 10% Exec · 10% Integr · 5% Cov
                        </p>
                      </div>
                    </div>

                    {/* Breakdown Metric Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Pass Rate Score (60%)', val: confidenceData.breakdown?.pass_rate_score ?? (score * 0.6).toFixed(1), max: 60 },
                        { label: 'Syntax Validity (15%)', val: confidenceData.breakdown?.syntax_score ?? 15.0, max: 15 },
                        { label: 'Execution Reliability (10%)', val: confidenceData.breakdown?.execution_score ?? 10.0, max: 10 },
                        { label: 'Integration Score (10%)', val: confidenceData.breakdown?.integration_score ?? 10.0, max: 10 },
                        { label: 'Test Coverage (5%)', val: confidenceData.breakdown?.coverage_score ?? 5.0, max: 5 },
                        { label: 'Dependency Preservation', val: `${confidenceData.dependency_preservation_pct ?? 100}%`, max: null },
                      ].map((item, i) => (
                        <div key={i} className="p-3 bg-gh-canvas border border-gh-border rounded-xl">
                          <span className="text-[11px] text-gh-textSubtle">{item.label}</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg font-bold text-gh-accent font-mono">{item.val}</span>
                            {item.max && <span className="text-[10px] text-gh-textSubtle font-mono">max {item.max}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 4. MIGRATION DOCS */}
            {activeSubTab === 'docs' && (
              <div className="bg-gh-canvas border border-gh-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-semibold text-gh-text flex items-center gap-1.5">
                    <FileText size={14} className="text-gh-accent" />
                    Auto-Generated Migration Documentation
                  </h4>
                  {documentationData?.markdown_docs && (
                    <button
                      onClick={() => handleCopy(documentationData.markdown_docs, 'docs')}
                      className="flex items-center gap-1 text-[11px] text-gh-textMuted hover:text-gh-text"
                    >
                      {copiedSection === 'docs' ? <Check size={12} className="text-gh-green" /> : <Copy size={12} />}
                      Copy Docs
                    </button>
                  )}
                </div>
                <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-gh-textMuted p-3 bg-gh-surface rounded-lg border border-gh-border">
                  {documentationData?.markdown_docs || '# Migration documentation will appear here after running pipeline.'}
                </div>
              </div>
            )}

            {/* 5. EXPLAINABILITY TRACE */}
            {activeSubTab === 'explainability' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-gh-canvas border border-gh-border rounded-xl">
                  <h4 className="text-xs font-semibold text-gh-text mb-1 flex items-center gap-1.5">
                    <Activity size={14} className="text-gh-accent" />
                    Reasoning Trace &amp; Business Rule Preservation
                  </h4>
                  <p className="text-xs text-gh-textSubtle">
                    Chronological step-by-step evidence of why the AI transpiled and verified specific constructs.
                  </p>
                </div>

                <div className="space-y-2">
                  {(explainabilityData?.reasoning_trace || [
                    { step: 1, title: 'Specification Extraction', description: 'Parsed MUMPS tags, external calls, and global accesses (^DPT).' },
                    { step: 2, title: 'Business Rule Preservation', description: 'Validated parameter boundaries and patient existence rules.' },
                    { step: 3, title: 'Transpilation & AST Generation', description: 'Generated Python functions matching MUMPS labels.' },
                    { step: 4, title: 'Sandboxed Verification', description: 'Executed converted code in isolated subprocess against strict test cases.' },
                  ]).map((t, idx) => (
                    <div key={idx} className="p-3 bg-gh-canvas border border-gh-border rounded-xl flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-gh-accent/10 border border-gh-accent/30 text-gh-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {t.step || idx + 1}
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-gh-text">{t.title || `Stage ${idx + 1}`}</h5>
                        <p className="text-xs text-gh-textMuted mt-0.5">{t.description || t.reason || JSON.stringify(t)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Human Review Actions & Notes Panel */}
        <div className="w-80 bg-gh-canvas border-l border-gh-border p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-bold text-gh-text uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare size={13} className="text-gh-accent" />
                Reviewer Decision &amp; Notes
              </h3>
              <p className="text-[11px] text-gh-textSubtle mt-1">
                Record your decision into the audit trail. Human reviewers have full authority to override AI scores.
              </p>
            </div>

            {/* AI Recommendation Alert */}
            <div className={`p-3 rounded-xl border ${aiSuggestion.badgeClass} flex flex-col gap-1.5`}>
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <aiSuggestion.icon size={13} />
                <span>AI Recommendation: {aiSuggestion.label}</span>
              </div>
              <p className="text-[11px] leading-normal opacity-90">
                {aiSuggestion.recommendation}
              </p>
            </div>

            {/* Reviewer Comments Textarea */}
            <div>
              <label className="block text-xs font-semibold text-gh-textMuted mb-1.5">
                Reviewer Comments / Notes
              </label>
              <textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Enter audit notes (e.g., Preserved ^DPT logic, verified edge case parameters)..."
                rows={4}
                className="w-full px-3 py-2 text-xs bg-gh-surface border border-gh-border rounded-xl text-gh-text placeholder-gh-textSubtle focus:outline-none focus:border-gh-accent resize-none transition-colors"
              />

              {/* Quick note suggestion chips */}
              <div className="mt-2 flex flex-wrap gap-1">
                {quickNotes.slice(0, 3).map((qn, i) => (
                  <button
                    key={i}
                    onClick={() => setReviewerNotes(prev => (prev ? `${prev}. ${qn}` : qn))}
                    className="text-[9px] px-2 py-0.5 rounded-full bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-textSubtle hover:text-gh-text transition-colors"
                  >
                    + {qn}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="flex flex-col gap-2 pt-2 border-t border-gh-border">
              {/* 1. APPROVE BUTTON */}
              <button
                onClick={() => handleAction('approved')}
                disabled={!conversion || isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                  currentDecision === 'approved'
                    ? 'bg-gh-green/20 text-gh-green border border-gh-greenDim/50'
                    : 'bg-gh-green text-gh-bg hover:bg-gh-green/90'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isSubmitting && submittingAction === 'approved' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>{currentDecision === 'approved' ? 'Approved (Re-submit)' : 'Approve & Download ZIP'}</span>
              </button>

              {/* 2. REJECT BUTTON */}
              <button
                onClick={() => handleAction('rejected')}
                disabled={!conversion || isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                  currentDecision === 'rejected'
                    ? 'bg-gh-red/20 text-gh-red border-gh-red/50'
                    : 'bg-gh-redBg hover:bg-gh-red/20 text-gh-red border-gh-red/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isSubmitting && submittingAction === 'rejected' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                <span>{currentDecision === 'rejected' ? 'Rejected' : 'Reject Conversion'}</span>
              </button>

              {/* 3. REQUEST CHANGES BUTTON */}
              <button
                onClick={() => handleAction('changes_requested')}
                disabled={!conversion || isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-medium transition-all border ${
                  currentDecision === 'changes_requested'
                    ? 'bg-gh-yellow/20 text-gh-yellow border-gh-yellow/50'
                    : 'bg-gh-yellowBg hover:bg-gh-yellow/20 text-gh-yellow border-gh-yellow/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isSubmitting && submittingAction === 'changes_requested' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <AlertTriangle size={13} />
                )}
                <span>Request Changes</span>
              </button>

              {/* 4. ROLLBACK BUTTON */}
              <button
                onClick={() => handleAction('reverted')}
                disabled={!conversion || isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-medium transition-all border ${
                  currentDecision === 'reverted'
                    ? 'bg-gh-purple/20 text-gh-purple border-gh-purple/50'
                    : 'bg-gh-purpleBg hover:bg-gh-purple/20 text-gh-purple border-gh-purple/30'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isSubmitting && submittingAction === 'reverted' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                <span>Rollback to Legacy Routine</span>
              </button>
            </div>
          </div>

          {/* Audit Timestamp Footer */}
          <div className="pt-3 border-t border-gh-border text-[10px] text-gh-textSubtle flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Audit Logging:</span>
              <span className="text-gh-green font-semibold">Active</span>
            </div>
            {reviewDecision?.decided_at && (
              <div>
                Decided: <span className="text-gh-textMuted">{new Date(reviewDecision.decided_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
