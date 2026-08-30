import React, { useState, useEffect } from 'react';
import {
  PackageCheck, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ShieldCheck, FileCode, Layers, Activity, ArrowRight, Download,
  Check, AlertCircle, Info, BarChart2, CheckCircle, ExternalLink
} from 'lucide-react';

export default function ProjectVerifyPanel({
  workspaceId,
  routines = [],
  onSelectRoutine,
  onOpenHumanReview,
  onExportZip,
  showToast,
}) {
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchProjectVerification = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${workspaceId || '__default__'}/verification`);
      if (res.ok) {
        const data = await res.json();
        setProjectData(data);
      }
    } catch (e) {
      console.error('Failed to fetch project verification', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunProjectVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/projects/${workspaceId || '__default__'}/verify`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setProjectData(data);
        showToast?.('✓ Project Verification complete', 'success');
      } else {
        showToast?.('Project Verification failed to execute', 'error');
      }
    } catch (e) {
      showToast?.(`Verification error: ${e.message}`, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchProjectVerification();
  }, [workspaceId]);

  const totalFiles = projectData?.total_files || routines.length || 0;
  const verifiedFiles = projectData?.verified_files || 0;
  const failedFiles = projectData?.failed_files || 0;
  const passRate = projectData?.pass_rate ?? 0;
  const avgConfidence = projectData?.average_confidence ?? 0;
  const depHealth = projectData?.dependency_health ?? 100;
  const projectStatus = projectData?.project_status || 'NOT_VERIFIED';

  // Status styling based on Requirement 4
  const getStatusBadge = (status) => {
    if (status === 'VERIFIED') {
      return {
        label: 'VERIFIED',
        desc: 'Pass Rate ≥ 90% & Avg Confidence ≥ 85% — Project is ready for production export',
        cls: 'bg-gh-greenBg text-gh-green border-gh-greenDim/40',
        icon: CheckCircle2,
      };
    }
    if (status === 'NEEDS_REVIEW') {
      return {
        label: 'NEEDS REVIEW',
        desc: 'Pass Rate 60%–89% — Manual inspection of failed routines required',
        cls: 'bg-gh-yellowBg text-gh-yellow border-gh-yellow/30',
        icon: AlertTriangle,
      };
    }
    if (status === 'FAILED') {
      return {
        label: 'FAILED',
        desc: 'Pass Rate < 60% — Critical verification errors detected',
        cls: 'bg-gh-redBg text-gh-red border-gh-red/20',
        icon: XCircle,
      };
    }
    return {
      label: 'NOT VERIFIED',
      desc: 'Run Project Verify to analyze workspace readiness',
      cls: 'bg-gh-surface2 text-gh-textMuted border-gh-border',
      icon: Info,
    };
  };

  const statusConfig = getStatusBadge(projectStatus);
  const StatusIcon = statusConfig.icon;

  const kpiCards = [
    { label: 'Total Files', value: totalFiles, icon: FileCode, color: 'text-gh-text', bg: 'bg-gh-canvas' },
    { label: 'Verified Files', value: verifiedFiles, icon: CheckCircle2, color: 'text-gh-green', bg: 'bg-gh-greenBg border-gh-greenDim/30' },
    { label: 'Failed Files', value: failedFiles, icon: XCircle, color: 'text-gh-red', bg: 'bg-gh-redBg border-gh-red/20' },
    { label: 'Pass Rate', value: `${passRate}%`, icon: Activity, color: 'text-gh-accent', bg: 'bg-gh-accentEmphasis/10 border-gh-accent/20' },
    { label: 'Avg Confidence', value: `${avgConfidence}%`, icon: ShieldCheck, color: 'text-gh-purple', bg: 'bg-gh-purpleBg border-gh-purple/20' },
    { label: 'Dependency Health', value: `${depHealth}%`, icon: Layers, color: 'text-gh-orange', bg: 'bg-orange-400/10 border-orange-400/20' },
  ];

  return (
    <div className="flex-1 bg-gh-bg overflow-y-auto p-6 animate-fadeIn select-none">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* ── Top Header Bar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-between items-start gap-4 p-5 bg-gh-canvas border border-gh-border rounded-2xl shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gh-accent/10 border border-gh-accent/20 flex items-center justify-center text-gh-accent">
              <PackageCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-gh-text tracking-tight">Project Verification Layer</h1>
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold flex items-center gap-1.5 ${statusConfig.cls}`}>
                  <StatusIcon size={13} />
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-xs text-gh-textSubtle mt-1">{statusConfig.desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRunProjectVerify}
              disabled={isVerifying || routines.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 bg-gh-accent hover:bg-gh-accent/90 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
            >
              <RefreshCw size={13} className={isVerifying ? 'animate-spin' : ''} />
              <span>{isVerifying ? 'Verifying Workspace…' : 'Run Project Verify'}</span>
            </button>

            {onExportZip && (
              <button
                onClick={onExportZip}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-textMuted hover:text-gh-text rounded-xl text-xs font-medium transition-colors"
              >
                <Download size={13} />
                <span>Export ZIP</span>
              </button>
            )}
          </div>
        </div>

        {/* ── KPI Grid ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className={`p-3.5 rounded-xl border border-gh-border ${kpi.bg} flex flex-col justify-between hover-lift`}>
                <div className="flex items-center justify-between text-gh-textSubtle">
                  <span className="text-[11px] font-medium">{kpi.label}</span>
                  <Icon size={14} className={kpi.color} />
                </div>
                <p className={`text-xl font-bold mt-2 font-mono ${kpi.color}`}>{kpi.value}</p>
              </div>
            );
          })}
        </div>

        {/* ── Health Progress Gauges ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Pass Rate Bar */}
          <div className="p-4 bg-gh-canvas border border-gh-border rounded-xl">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-gh-text">Test Pass Rate</span>
              <span className="font-mono font-bold text-gh-accent">{passRate}%</span>
            </div>
            <div className="w-full bg-gh-surface2 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  passRate >= 90 ? 'bg-gh-green' : passRate >= 60 ? 'bg-gh-yellow' : 'bg-gh-red'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, passRate))}%` }}
              />
            </div>
            <span className="text-[10px] text-gh-textSubtle mt-1.5 block">Threshold: ≥ 90% required for VERIFIED</span>
          </div>

          {/* 2. Confidence Score Bar */}
          <div className="p-4 bg-gh-canvas border border-gh-border rounded-xl">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-gh-text">Avg Confidence Score</span>
              <span className="font-mono font-bold text-gh-purple">{avgConfidence}%</span>
            </div>
            <div className="w-full bg-gh-surface2 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  avgConfidence >= 85 ? 'bg-gh-green' : avgConfidence >= 50 ? 'bg-gh-yellow' : 'bg-gh-red'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, avgConfidence))}%` }}
              />
            </div>
            <span className="text-[10px] text-gh-textSubtle mt-1.5 block">Threshold: ≥ 85% required for VERIFIED</span>
          </div>

          {/* 3. Dependency Health Bar */}
          <div className="p-4 bg-gh-canvas border border-gh-border rounded-xl">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="font-semibold text-gh-text">Dependency Health</span>
              <span className="font-mono font-bold text-gh-orange">{depHealth}%</span>
            </div>
            <div className="w-full bg-gh-surface2 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  depHealth >= 85 ? 'bg-gh-green' : 'bg-gh-yellow'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, depHealth))}%` }}
              />
            </div>
            <span className="text-[10px] text-gh-textSubtle mt-1.5 block">Evaluates cross-file calls &amp; global references</span>
          </div>
        </div>

        {/* ── Per-File Verification Summary List ─────────────────────────── */}
        <div className="bg-gh-canvas border border-gh-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 bg-gh-surface border-b border-gh-border flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-gh-text uppercase tracking-wider">Workspace Routines Summary</h3>
              <p className="text-[11px] text-gh-textSubtle mt-0.5">Verification status and confidence per legacy module</p>
            </div>
            <span className="text-xs text-gh-textMuted font-mono">
              {verifiedFiles} / {totalFiles} Verified
            </span>
          </div>

          <div className="divide-y divide-gh-border/60">
            {(projectData?.file_summaries || routines).map((f, i) => {
              const name = f.name || `routine_${i}`;
              const relPath = f.relative_path || `${name}.m`;
              const isVer = f.is_verified || f.verification_status === 'VERIFIED';
              const conf = f.confidence_score ?? 0;
              const passedT = f.passed_tests ?? 0;
              const totalT = f.total_tests ?? 0;

              return (
                <div
                  key={i}
                  className="px-5 py-3 flex items-center justify-between hover:bg-gh-surface/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isVer ? 'bg-gh-greenBg text-gh-green' : 'bg-gh-surface2 text-gh-textMuted'
                    }`}>
                      {isVer ? <CheckCircle size={15} /> : <FileCode size={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gh-text font-mono truncate">{relPath}</p>
                      <span className="text-[10px] text-gh-textSubtle">MUMPS Routine · {name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-gh-textSubtle">Tests</span>
                      <p className="text-xs font-mono text-gh-text">
                        <span className={passedT === totalT && totalT > 0 ? 'text-gh-green' : 'text-gh-textMuted'}>{passedT}</span>
                        <span className="text-gh-textSubtle">/{totalT}</span>
                      </p>
                    </div>

                    <div className="text-right w-16">
                      <span className="text-[10px] text-gh-textSubtle">Confidence</span>
                      <p className={`text-xs font-mono font-bold ${conf >= 85 ? 'text-gh-green' : conf >= 50 ? 'text-gh-yellow' : 'text-gh-red'}`}>
                        {conf}%
                      </p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      isVer
                        ? 'bg-gh-greenBg text-gh-green border-gh-greenDim/30'
                        : 'bg-gh-yellowBg text-gh-yellow border-gh-yellow/30'
                    }`}>
                      {isVer ? 'VERIFIED' : 'PENDING'}
                    </span>

                    {onSelectRoutine && (
                      <button
                        onClick={() => onSelectRoutine(f)}
                        title="Open routine in editor"
                        className="p-1 rounded text-gh-textSubtle hover:text-gh-text hover:bg-gh-surface"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {(!projectData?.file_summaries || projectData.file_summaries.length === 0) && routines.length === 0 && (
              <div className="p-8 text-center text-gh-textSubtle text-xs">
                No files in the current workspace. Upload MUMPS routines to verify the project.
              </div>
            )}
          </div>
        </div>

        {/* ── Next Steps: Human Review Callout ───────────────────────────── */}
        <div className="p-4 bg-gh-surface border border-gh-border rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gh-accent/10 text-gh-accent flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gh-text">Next Step: Human-in-the-Loop Review</h4>
              <p className="text-[11px] text-gh-textSubtle">Inspect code differences, verify business logic, and record audit decisions.</p>
            </div>
          </div>
          {onOpenHumanReview && (
            <button
              onClick={onOpenHumanReview}
              className="flex items-center gap-1 px-3 py-1.5 bg-gh-accent hover:bg-gh-accent/90 text-white rounded-lg text-xs font-semibold transition-all shrink-0"
            >
              <span>Open Human Review</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
