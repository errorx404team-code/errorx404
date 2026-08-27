import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export default function MigrationReportModal({ routineId, onClose }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!routineId) return;
    
    fetch(`/api/routines/${routineId}/migration-report`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch report');
        return res.json();
      })
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [routineId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-gh-canvas border border-gh-border rounded-2xl p-8 flex flex-col items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-gh-accent"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <p className="mt-4 text-sm text-gh-textMuted">Loading Migration Report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-gh-canvas border border-gh-border rounded-2xl p-8 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-gh-red font-bold flex items-center gap-2"><AlertTriangle size={18}/> Error</h2>
            <button onClick={onClose}><X size={18} className="text-gh-textMuted hover:text-gh-text"/></button>
          </div>
          <p className="text-sm text-gh-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-hidden">
      <div className="bg-gh-canvas border border-gh-border rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-modal animate-fadeInScale">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gh-border bg-gh-surface2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gh-accent/20 border border-gh-accent/30 flex items-center justify-center">
              <FileText size={16} className="text-gh-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gh-text">Complete Migration Report</h2>
              <p className="text-xs text-gh-textMuted">
                {report.before.name} • {report.migration.source_language} <ArrowRight size={10} className="inline" /> {report.migration.target_language} • Status: {report.migration.status}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-gh-border bg-gh-bg">
            <div className="bg-gh-surface rounded-lg p-3 border border-gh-border">
                <p className="text-[10px] text-gh-textMuted uppercase font-semibold">Confidence</p>
                <p className={`text-lg font-bold mt-1 ${report.validation.confidence_score !== "Not Available" && report.validation.confidence_score >= 75 ? 'text-gh-green' : report.validation.confidence_score !== "Not Available" && report.validation.confidence_score >= 60 ? 'text-gh-yellow' : 'text-gh-red'}`}>
                    {report.validation.confidence_score !== "Not Available" ? `${Number(report.validation.confidence_score).toFixed(1)}%` : 'N/A'}
                </p>
            </div>
            <div className="bg-gh-surface rounded-lg p-3 border border-gh-border">
                <p className="text-[10px] text-gh-textMuted uppercase font-semibold">Validation</p>
                <p className={`text-lg font-bold mt-1 ${report.validation.verification_status === 'VERIFIED' || report.validation.pass_rate === 100 ? 'text-gh-green' : report.validation.pass_rate > 0 ? 'text-gh-yellow' : 'text-gh-red'}`}>
                    {report.validation.passed_tests} / {report.validation.total_tests} Passed
                </p>
            </div>
            <div className="bg-gh-surface rounded-lg p-3 border border-gh-border">
                <p className="text-[10px] text-gh-textMuted uppercase font-semibold">Review Decision</p>
                <p className={`text-lg font-bold mt-1 capitalize ${report.decision.review_status === 'approved' ? 'text-gh-green' : report.decision.review_status === 'rejected' ? 'text-gh-red' : 'text-gh-textMuted'}`}>
                    {report.decision.review_status}
                </p>
            </div>
            <div className="bg-gh-surface rounded-lg p-3 border border-gh-border">
                <p className="text-[10px] text-gh-textMuted uppercase font-semibold">Model</p>
                <p className="text-sm font-bold mt-1 text-gh-text truncate" title={report.migration.model_used}>
                    {report.migration.model_used}
                </p>
            </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gh-bg">
          
          {/* 1. BEFORE */}
          <section>
            <h3 className="text-sm font-bold text-gh-text border-b border-gh-border pb-2 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gh-surface2 border border-gh-border flex items-center justify-center text-xs">1</span>
              BEFORE (Legacy State)
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-gh-surface p-3 rounded border border-gh-border">
                <p className="text-gh-textMuted mb-1 font-semibold">Source Details</p>
                <p><span className="text-gh-textMuted">Name:</span> <span className="font-mono text-gh-text">{report.before.name}</span></p>
                <p><span className="text-gh-textMuted">Language:</span> <span className="text-gh-text">{report.before.source_language}</span></p>
                <p><span className="text-gh-textMuted">Path:</span> <span className="font-mono text-gh-text">{report.before.relative_path || 'N/A'}</span></p>
              </div>
              <div className="bg-gh-surface p-3 rounded border border-gh-border max-h-32 overflow-y-auto">
                <p className="text-gh-textMuted mb-1 font-semibold">Dependencies</p>
                {Array.isArray(report.before.dependencies) ? (
                    <ul className="space-y-0.5 font-mono text-[11px]">
                        {report.before.dependencies.map((d, i) => (
                            <li key={i} className="text-gh-textSubtle">• {d.id} <span className="text-gh-textMuted">({d.type})</span></li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gh-textMuted italic">No static dependencies mapped</p>
                )}
              </div>
            </div>
          </section>

          {/* 2. SPECIFICATION */}
          <section>
            <h3 className="text-sm font-bold text-gh-text border-b border-gh-border pb-2 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gh-surface2 border border-gh-border flex items-center justify-center text-xs">2</span>
              SPECIFICATION (Extracted Rules)
            </h3>
            <div className="bg-gh-surface p-3 rounded border border-gh-border text-xs text-gh-text space-y-2">
                <p className="font-semibold text-gh-textMuted">Business Rules Ground Truth</p>
                <div className="font-mono bg-gh-bg p-2 rounded border border-gh-border text-gh-textSubtle max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {report.before.spec_readable_text || "No spec text available"}
                </div>
            </div>
          </section>

          {/* 3. AFTER */}
          <section>
            <h3 className="text-sm font-bold text-gh-text border-b border-gh-border pb-2 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gh-surface2 border border-gh-border flex items-center justify-center text-xs">3</span>
              AFTER (Target {report.after.target_language})
            </h3>
            <div className="bg-gh-surface p-3 rounded border border-gh-border text-xs text-gh-text space-y-3">
                <div>
                    <p className="font-semibold text-gh-textMuted mb-1">Modernized Code Preview</p>
                    <pre className="font-mono bg-gh-bg p-2.5 rounded border border-gh-border text-gh-text max-h-40 overflow-y-auto overflow-x-auto text-[11px]">
                        {report.after.generated_code || "No code generated yet."}
                    </pre>
                </div>
                <div>
                    <p className="font-semibold text-gh-textMuted mb-1">Traceability Metadata</p>
                    <pre className="font-mono bg-gh-bg p-2 rounded border border-gh-border text-gh-accent text-[11px]">
                        {report.after.traceability_header || "No traceability header generated."}
                    </pre>
                </div>
            </div>
          </section>

          {/* 4. VALIDATION */}
          <section>
            <h3 className="text-sm font-bold text-gh-text border-b border-gh-border pb-2 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gh-surface2 border border-gh-border flex items-center justify-center text-xs">4</span>
              VALIDATION
            </h3>
            <div className="bg-gh-surface p-3 rounded border border-gh-border text-xs text-gh-text flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p><span className="text-gh-textMuted inline-block w-32">Status:</span> <span className={`font-semibold ${report.validation.verification_status === 'VERIFIED' ? 'text-gh-green' : report.validation.verification_status === 'FAILED' ? 'text-gh-red' : 'text-gh-yellow'}`}>{report.validation.verification_status}</span></p>
                        <p><span className="text-gh-textMuted inline-block w-32">Total Tests:</span> {report.validation.total_tests}</p>
                        <p><span className="text-gh-textMuted inline-block w-32">Passed / Failed:</span> {report.validation.passed_tests} / {report.validation.failed_tests}</p>
                        <p><span className="text-gh-textMuted inline-block w-32">Pass Rate:</span> {report.validation.pass_rate}%</p>
                    </div>
                    <div>
                        <p><span className="text-gh-textMuted inline-block w-32">Confidence Score:</span> {report.validation.confidence_score !== 'Not Available' ? `${Number(report.validation.confidence_score).toFixed(1)}%` : 'N/A'}</p>
                        <p><span className="text-gh-textMuted inline-block w-32">Category:</span> <span className="capitalize font-medium">{report.validation.confidence_category}</span></p>
                    </div>
                </div>
                {report.validation.failed_tests > 0 && report.validation.mismatch_details && report.validation.mismatch_details.length > 0 && (
                    <div className="mt-2">
                        <p className="text-gh-red font-semibold mb-1">Mismatches / Failures</p>
                        <ul className="list-disc pl-4 space-y-1 text-gh-red">
                            {report.validation.mismatch_details.map((m, i) => (
                                <li key={i}>{m}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
          </section>

          {/* 5. DECISION */}
          <section>
            <h3 className="text-sm font-bold text-gh-text border-b border-gh-border pb-2 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-gh-surface2 border border-gh-border flex items-center justify-center text-xs">5</span>
              DECISION
            </h3>
            <div className="bg-gh-surface p-3 rounded border border-gh-border text-xs text-gh-text flex flex-col gap-2">
                <p><span className="text-gh-textMuted w-32 inline-block">Final Status:</span> <span className="capitalize font-semibold">{report.decision.final_status}</span></p>
                <p><span className="text-gh-textMuted w-32 inline-block">Review Decision:</span> <span className="capitalize">{report.decision.review_status}</span></p>
                <p><span className="text-gh-textMuted w-32 inline-block">Reviewer Notes:</span> {report.decision.reviewer_notes || 'None'}</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
