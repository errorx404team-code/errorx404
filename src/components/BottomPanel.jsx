import React from 'react';
<<<<<<< HEAD
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Network, Layers, FileText, Cpu, Activity, Terminal, GitBranch, ListOrdered, PackageCheck, AlertCircle, BookOpen } from 'lucide-react';
import HumanUnderstandingPanel from './HumanUnderstandingPanel';
import DependencyGraphPanel from './DependencyGraphPanel';
=======
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Network, Layers, FileText, Cpu, Activity } from 'lucide-react';
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab

export default function BottomPanel({
  activeBottomTab,
  setActiveBottomTab,
  verificationData,
  confidenceData,
  explainabilityData,
  dependencyData,
  partitionData,
<<<<<<< HEAD
  documentationData,
  projectPipelineLog = [],
  projectPipelineStatus = 'idle',
  routineStatuses = {},
  routines = [],
  // New props for project-level features
  conversionPlan = null,
  projectVerification = null,
  workspaceCycles = [],
  // Feature 1: Human Understanding
  conversion = null,
  activeRoutine = null,
  // Feature 2: Dependency Graph gate props
  analysisComplete = false,
  isAnalyzing = false,
  onRunAnalysis = null,
  onProceedToConversion = null,
=======
  documentationData
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
}) {
  const tabs = [
    { id: 'verification', label: 'Verification', icon: CheckCircle2 },
    { id: 'confidence', label: 'Confidence', icon: ShieldCheck },
    { id: 'explainability', label: 'Explainability', icon: Activity },
<<<<<<< HEAD
    { id: 'dependency', label: 'Dep Graph', icon: Network },
    { id: 'human-understanding', label: 'Human View', icon: BookOpen },
    { id: 'partitioning', label: 'Logic Map', icon: Layers },
    { id: 'docs', label: 'Docs', icon: FileText },
    { id: 'conversion-plan', label: 'Conv Plan', icon: ListOrdered },
    { id: 'project-verify', label: 'Proj Verify', icon: PackageCheck },
    { id: 'pipeline-output', label: 'Pipeline', icon: Terminal },
=======
    { id: 'dependency', label: 'Dependency Graph', icon: Network },
    { id: 'partitioning', label: 'Logic Map', icon: Layers },
    { id: 'docs', label: 'Docs', icon: FileText },
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
  ];

  const Empty = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
      <Cpu size={22} className="text-gh-textSubtle opacity-40" />
      <p className="text-xs text-gh-textSubtle">{message}</p>
    </div>
  );

<<<<<<< HEAD
  // Human understanding panel needs full height — expand when active
  const isFullHeight = activeBottomTab === 'human-understanding' || activeBottomTab === 'dependency';

  return (
    <div className={`${isFullHeight ? 'h-80' : 'h-56'} bg-gh-canvas border-t border-gh-border flex flex-col shrink-0 select-none transition-all duration-200`}>
      {/* Tab Header */}
      <div className="bg-gh-surface2 border-b border-gh-border flex justify-between items-center px-2 h-8 shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center shrink-0">
          {tabs.map((t) => {
            const isActive = activeBottomTab === t.id;
            const Icon = t.icon;
            // Badge: show cycle warning on conversion-plan tab
            const showBadge = t.id === 'conversion-plan' && workspaceCycles.length > 0;
            const showVerBadge = t.id === 'project-verify' && projectVerification && projectVerification.overall_status === 'FAILED';
=======
  return (
    <div className="h-56 bg-gh-canvas border-t border-gh-border flex flex-col shrink-0 select-none">
      {/* Tab Header */}
      <div className="bg-gh-surface2 border-b border-gh-border flex justify-between items-center px-2 h-8 shrink-0">
        <div className="flex items-center">
          {tabs.map((t) => {
            const isActive = activeBottomTab === t.id;
            const Icon = t.icon;
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
            return (
              <button
                key={t.id}
                onClick={() => setActiveBottomTab(t.id)}
<<<<<<< HEAD
                className={`relative flex items-center gap-1.5 px-3 py-1 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
=======
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium border-b-2 transition-colors ${
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                  isActive
                    ? 'border-gh-accent text-gh-text bg-gh-canvas'
                    : 'border-transparent text-gh-textSubtle hover:text-gh-textMuted hover:bg-gh-surface/60'
                }`}
              >
                <Icon size={11} />
                {t.label}
<<<<<<< HEAD
                {(showBadge || showVerBadge) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gh-yellow absolute top-1 right-1" />
                )}
=======
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
              </button>
            );
          })}
        </div>

        {confidenceData && (
<<<<<<< HEAD
          <div className="flex items-center gap-2 text-xs pr-3 shrink-0">
=======
          <div className="flex items-center gap-2 text-xs pr-3">
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
            <span
              className={`badge ${
                confidenceData.category === 'safe'
                  ? 'bg-gh-greenBg text-gh-green border border-gh-greenDim/30'
                  : confidenceData.category === 'needs_review'
                  ? 'bg-gh-yellowBg text-gh-yellow border border-gh-yellow/30'
                  : 'bg-gh-redBg text-gh-red border border-gh-red/20'
              }`}
            >
              {confidenceData.score}% {confidenceData.category.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 text-xs text-gh-text">
<<<<<<< HEAD

        {/* ── Verification ─────────────────────────────────────────────────── */}
=======
        {/* Verification */}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
        {activeBottomTab === 'verification' && (
          !verificationData ? (
            <Empty message="Run pipeline to execute verification suite" />
          ) : (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <div className="flex gap-4 p-2.5 bg-gh-surface rounded-xl border border-gh-border">
                <span>Total: <strong className="text-gh-text">{verificationData.total_tests}</strong></span>
                <span>Passed: <strong className="text-gh-green">{verificationData.passed_tests}</strong></span>
                <span>Failed: <strong className="text-gh-red">{verificationData.failed_tests}</strong></span>
                <span>Pass Rate: <strong className="text-gh-accent">{verificationData.pass_rate}%</strong></span>
              </div>
<<<<<<< HEAD
=======

>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="text-gh-textSubtle font-semibold uppercase tracking-wide">
                      <th className="p-2 border-b border-gh-border">Test ID</th>
                      <th className="p-2 border-b border-gh-border">Input</th>
                      <th className="p-2 border-b border-gh-border">Expected</th>
                      <th className="p-2 border-b border-gh-border">Actual</th>
                      <th className="p-2 border-b border-gh-border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationData.results.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gh-surface/50 transition-colors">
                        <td className="p-2 font-mono text-gh-textMuted">{r.test_case_id}</td>
                        <td className="p-2 font-mono text-gh-textSubtle truncate max-w-[160px]">{r.input_json}</td>
                        <td className="p-2 font-mono">{r.expected_output}</td>
                        <td className="p-2 font-mono text-gh-textMuted">{r.actual_output || '—'}</td>
                        <td className="p-2">
                          {r.passed ? (
<<<<<<< HEAD
                            <span className="flex items-center gap-1 text-gh-green font-semibold"><CheckCircle2 size={12} /> PASS</span>
                          ) : (
                            <span className="flex items-center gap-1 text-gh-red font-semibold" title={r.mismatch_details}><XCircle size={12} /> FAIL</span>
=======
                            <span className="flex items-center gap-1 text-gh-green font-semibold">
                              <CheckCircle2 size={12} /> PASS
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gh-red font-semibold" title={r.mismatch_details}>
                              <XCircle size={12} /> FAIL
                            </span>
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

<<<<<<< HEAD
        {/* ── Confidence Score ──────────────────────────────────────────────── */}
=======
        {/* Confidence Score */}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
        {activeBottomTab === 'confidence' && (
          !confidenceData ? (
            <Empty message="Run pipeline to calculate confidence score" />
          ) : (
            <div className="flex flex-col gap-3 max-w-2xl animate-fadeIn">
              <div className="p-3 bg-gh-surface rounded-xl border border-gh-border flex items-center gap-4">
<<<<<<< HEAD
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#21262d" strokeWidth="3"/>
                    <circle cx="18" cy="18" r="15.9" fill="none"
=======
                {/* Score ring */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#21262d" strokeWidth="3"/>
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                      stroke={confidenceData.category === 'safe' ? '#3fb950' : confidenceData.category === 'needs_review' ? '#d29922' : '#f85149'}
                      strokeWidth="3"
                      strokeDasharray={`${confidenceData.score} ${100 - confidenceData.score}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold text-gh-text">{confidenceData.score}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gh-text mb-1">
                    Classification:{' '}
<<<<<<< HEAD
                    <span className={`${confidenceData.category === 'safe' ? 'text-gh-green' : confidenceData.category === 'needs_review' ? 'text-gh-yellow' : 'text-gh-red'}`}>
=======
                    <span className={`${
                      confidenceData.category === 'safe' ? 'text-gh-green' :
                      confidenceData.category === 'needs_review' ? 'text-gh-yellow' :
                      'text-gh-red'
                    }`}>
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                      {confidenceData.category.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gh-textMuted leading-relaxed text-[11px]">{confidenceData.reasoning_text}</p>
<<<<<<< HEAD
                  {confidenceData.dependency_preservation_pct != null && (
                    <div className="flex gap-3 mt-1.5 text-[10px] text-gh-textSubtle">
                      <span>Dep. Preservation: <strong className="text-gh-accent">{confidenceData.dependency_preservation_pct}%</strong></span>
                      <span>Interface Compat: <strong className="text-gh-accent">{confidenceData.interface_compatibility_pct}%</strong></span>
                    </div>
                  )}
=======
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                </div>
              </div>
              <div className="p-2.5 bg-gh-bg rounded-xl border border-gh-border text-gh-textSubtle leading-relaxed font-mono text-[10px] space-y-1">
                <p className="text-gh-textMuted font-semibold text-xs mb-1">Score Formula</p>
                <p>• Verification Pass Rate × 0.6 (execution across test vectors)</p>
                <p>• Code Complexity × 0.2 (structural depth & safety)</p>
                <p>• Mismatch Severity × 0.2 (error drift penalty)</p>
<<<<<<< HEAD
                <p>• Project: blended with integration score (dep preservation + import check)</p>
=======
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
              </div>
            </div>
          )
        )}

<<<<<<< HEAD
        {/* ── Explainability ────────────────────────────────────────────────── */}
=======
        {/* Explainability */}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
        {activeBottomTab === 'explainability' && (
          !explainabilityData ? (
            <Empty message="Run pipeline to generate explainability trace" />
          ) : (
            <div className="flex flex-col gap-2 max-w-3xl animate-fadeIn">
              {explainabilityData.reasoning_trace.map((item, i) => (
                <div key={i} className="p-2.5 bg-gh-surface rounded-xl border border-gh-border flex items-start gap-3">
<<<<<<< HEAD
                  <div className="w-6 h-6 rounded-lg bg-gh-accentEmphasis text-white font-bold flex items-center justify-center text-[10px] shrink-0">{item.step}</div>
=======
                  <div className="w-6 h-6 rounded-lg bg-gh-accentEmphasis text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                    {item.step}
                  </div>
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gh-text text-[11px]">{item.title}</div>
                    <div className="text-gh-textMuted mt-0.5 text-[11px] leading-relaxed">{item.details}</div>
                    <div className="text-gh-accent font-mono text-[10px] mt-1">Impact: {item.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

<<<<<<< HEAD
        {/* ── Dependency Graph (visual SVG panel) ──────────────────────────── */}
        {activeBottomTab === 'dependency' && (
          <DependencyGraphPanel
            dependencyData={dependencyData}
            activeRoutine={activeRoutine}
            analysisComplete={analysisComplete}
            isAnalyzing={isAnalyzing}
            onRunAnalysis={onRunAnalysis}
            onProceedToConversion={onProceedToConversion}
          />
        )}

        {/* ── Human Understanding Panel ────────────────────────────────────── */}
        {activeBottomTab === 'human-understanding' && (
          <HumanUnderstandingPanel conversion={conversion} activeRoutine={activeRoutine} />
        )}

        {/* ── Business Logic Partitioning ───────────────────────────────────── */}
=======
        {/* Dependency Graph */}
        {activeBottomTab === 'dependency' && (
          !dependencyData ? (
            <Empty message="Run pipeline to parse dependency graph" />
          ) : (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <div className="text-[11px] text-gh-textMuted font-mono">
                Nodes: <span className="text-gh-text font-bold">{dependencyData.nodes.length}</span>
                <span className="mx-2 text-gh-textSubtle">·</span>
                Edges: <span className="text-gh-text font-bold">{dependencyData.edges.length}</span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {dependencyData.nodes.map((node, i) => (
                  <div key={i} className="p-2.5 bg-gh-surface border border-gh-border rounded-xl flex flex-col gap-1.5">
                    <span className="font-mono text-gh-text font-medium text-[11px] truncate">{node.label}</span>
                    <span className={`badge w-fit text-[9px] ${
                      node.type === 'routine' ? 'bg-gh-accentEmphasis/10 text-gh-accent border border-gh-accent/20' :
                      node.type === 'global_variable' ? 'bg-gh-purpleBg text-gh-purple border border-gh-purple/20' :
                      node.type === 'external_routine' ? 'bg-gh-yellowBg text-gh-yellow border border-gh-yellow/20' :
                      'bg-gh-surface2 text-gh-textSubtle border border-gh-border'
                    }`}>
                      {node.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Business Logic Partitioning */}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
        {activeBottomTab === 'partitioning' && (
          !partitionData ? (
            <Empty message="Run pipeline for business logic partition analysis" />
          ) : (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <div className="p-2.5 bg-gh-surface rounded-xl border border-gh-border flex justify-between items-center">
<<<<<<< HEAD
                <span className="text-[11px] text-gh-textMuted">Overall Cohesion: <span className="text-gh-green font-bold text-sm">{partitionData.overall_cohesion}%</span></span>
=======
                <span className="text-[11px] text-gh-textMuted">
                  Overall Cohesion: <span className="text-gh-green font-bold text-sm">{partitionData.overall_cohesion}%</span>
                </span>
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                <span className="text-[10px] text-gh-textSubtle italic">Mono2Micro-inspired</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {partitionData.partitions.map((p, i) => (
                  <div key={i} className="p-3 bg-gh-bg border border-gh-border rounded-xl flex flex-col gap-2">
                    <h4 className="font-semibold text-gh-text text-[11px]">{p.partition_name}</h4>
<<<<<<< HEAD
                    <div className="text-[10px] text-gh-textSubtle font-mono truncate"><span className="text-gh-accent">{p.member_functions.join(', ')}</span></div>
=======
                    <div className="text-[10px] text-gh-textSubtle font-mono truncate">
                      <span className="text-gh-accent">{p.member_functions.join(', ')}</span>
                    </div>
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                    <div className="flex justify-between text-[10px] border-t border-gh-border pt-1.5">
                      <span>Cohesion: <strong className="text-gh-green">{p.cohesion_percentage}%</strong></span>
                      <span>Coupling: <strong className="text-gh-yellow">{p.coupling_percentage}%</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

<<<<<<< HEAD
        {/* ── Migration Docs ────────────────────────────────────────────────── */}
=======
        {/* Migration Docs */}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
        {activeBottomTab === 'docs' && (
          !documentationData ? (
            <Empty message="Run pipeline to generate technical documentation" />
          ) : (
            <div className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-gh-textMuted p-3 bg-gh-bg rounded-xl border border-gh-border animate-fadeIn">
              {documentationData.markdown_docs}
            </div>
          )
        )}
<<<<<<< HEAD

        {/* ── NEW: Conversion Plan ─────────────────────────────────────────── */}
        {activeBottomTab === 'conversion-plan' && (
          !conversionPlan ? (
            <Empty message="Run project pipeline to generate dependency-aware conversion plan" />
          ) : (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] text-gh-textMuted">
                  Files: <strong className="text-gh-text">{conversionPlan.files?.length || 0}</strong>
                </span>
                <span className={`badge text-[10px] ${conversionPlan.has_cycles ? 'bg-gh-yellowBg text-gh-yellow border border-gh-yellow/30' : 'bg-gh-greenBg text-gh-green border border-gh-greenDim/30'}`}>
                  {conversionPlan.has_cycles ? `⚠ ${workspaceCycles.length} Cycle(s) Detected` : '✓ No Cycles'}
                </span>
                {conversionPlan.order_description && (
                  <span className="text-[10px] text-gh-textSubtle italic">{conversionPlan.order_description}</span>
                )}
              </div>

              {/* Cycle warnings */}
              {workspaceCycles.length > 0 && (
                <div className="p-2.5 bg-gh-yellowBg border border-gh-yellow/30 rounded-xl">
                  <p className="text-[11px] font-semibold text-gh-yellow mb-1 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Circular Dependencies Detected — Manual Resolution Required
                  </p>
                  {workspaceCycles.map((cycle, i) => (
                    <p key={i} className="font-mono text-[10px] text-gh-textMuted">{cycle.join(' → ')}</p>
                  ))}
                </div>
              )}

              {/* Conversion order table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="text-gh-textSubtle font-semibold uppercase tracking-wide">
                      <th className="p-2 border-b border-gh-border w-8">#</th>
                      <th className="p-2 border-b border-gh-border">File</th>
                      <th className="p-2 border-b border-gh-border">Action</th>
                      <th className="p-2 border-b border-gh-border">Depends On</th>
                      <th className="p-2 border-b border-gh-border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(conversionPlan.files || []).map((f, i) => (
                      <tr key={i} className="hover:bg-gh-surface/40 transition-colors">
                        <td className="p-2 font-mono text-gh-textSubtle">{f.priority}</td>
                        <td className="p-2 font-mono text-gh-text font-medium truncate max-w-[180px]">{f.path || f.name}</td>
                        <td className="p-2">
                          <span className={`badge text-[9px] ${
                            f.action === 'CONVERT' ? 'bg-gh-accentEmphasis/10 text-gh-accent border border-gh-accent/20' :
                            f.action === 'PRESERVE' ? 'bg-gh-greenBg text-gh-green border border-gh-greenDim/20' :
                            f.action === 'ADAPT' ? 'bg-gh-purpleBg text-gh-purple border border-gh-purple/20' :
                            f.action === 'REVIEW_REQUIRED' ? 'bg-gh-yellowBg text-gh-yellow border border-gh-yellow/20' :
                            'bg-gh-surface2 text-gh-textSubtle border border-gh-border'
                          }`}>{f.action}</span>
                        </td>
                        <td className="p-2 font-mono text-[10px] text-gh-textSubtle truncate max-w-[180px]">
                          {f.depends_on?.length > 0 ? f.depends_on.join(', ') : '—'}
                        </td>
                        <td className="p-2">
                          {f.blocked_by ? (
                            <span className="text-gh-red text-[10px] flex items-center gap-1"><XCircle size={10} /> BLOCKED BY {f.blocked_by}</span>
                          ) : routineStatuses[f.routine_id] === 'completed' ? (
                            <span className="text-gh-green text-[10px] flex items-center gap-1"><CheckCircle2 size={10} /> Done</span>
                          ) : routineStatuses[f.routine_id] === 'failed' ? (
                            <span className="text-gh-red text-[10px]">Failed</span>
                          ) : (
                            <span className="text-gh-textSubtle text-[10px]">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* ── NEW: Project-Level Verification ─────────────────────────────── */}
        {activeBottomTab === 'project-verify' && (
          !projectVerification ? (
            <Empty message="Run 'Verify Project' to check all converted files together" />
          ) : (
            <div className="flex flex-col gap-3 animate-fadeIn">
              {/* Overall status */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                projectVerification.overall_status === 'PASSED' ? 'bg-gh-greenBg border-gh-greenDim/40' :
                projectVerification.overall_status === 'FAILED' ? 'bg-gh-redBg border-gh-red/20' :
                'bg-gh-yellowBg border-gh-yellow/30'
              }`}>
                <div>
                  <p className="font-semibold text-gh-text text-sm">Project Verification: {' '}
                    <span className={projectVerification.overall_status === 'PASSED' ? 'text-gh-green' : projectVerification.overall_status === 'FAILED' ? 'text-gh-red' : 'text-gh-yellow'}>
                      {projectVerification.overall_status}
                    </span>
                  </p>
                  {projectVerification.confidence_score != null && (
                    <p className="text-[11px] text-gh-textMuted mt-0.5">
                      Confidence: <strong className="text-gh-accent">{projectVerification.confidence_score}%</strong>
                      {' '}({projectVerification.confidence_category?.replace('_', ' ').toUpperCase()})
                    </p>
                  )}
                </div>
                <div className="text-[10px] font-mono text-gh-textMuted text-right space-y-0.5">
                  <p>Files: <strong className="text-gh-text">{projectVerification.files_verified}/{projectVerification.total_files}</strong></p>
                  <p>Syntax: <strong className="text-gh-green">{projectVerification.syntax_passed}</strong></p>
                  <p>Imports: <strong className="text-gh-green">{projectVerification.import_passed}</strong></p>
                  <p>Integration: <strong className="text-gh-accent">{projectVerification.integration_tests_passed}/{projectVerification.integration_tests_total}</strong></p>
                  <p>Dep Issues: <strong className={projectVerification.dependency_issues > 0 ? 'text-gh-red' : 'text-gh-green'}>{projectVerification.dependency_issues}</strong></p>
                </div>
              </div>

              {/* Broken imports */}
              {projectVerification.broken_imports?.length > 0 && (
                <div className="p-2.5 bg-gh-redBg border border-gh-red/20 rounded-xl">
                  <p className="text-[11px] font-semibold text-gh-red mb-1">Broken Imports ({projectVerification.broken_imports.length})</p>
                  {projectVerification.broken_imports.slice(0, 5).map((bi, i) => (
                    <p key={i} className="font-mono text-[10px] text-gh-textMuted">{bi.file}: {bi.issue}</p>
                  ))}
                </div>
              )}

              {/* Blocked files */}
              {Object.keys(projectVerification.blocked_files || {}).length > 0 && (
                <div className="p-2.5 bg-gh-yellowBg border border-gh-yellow/30 rounded-xl">
                  <p className="text-[11px] font-semibold text-gh-yellow mb-1">Blocked Files</p>
                  {Object.entries(projectVerification.blocked_files).map(([f, reason], i) => (
                    <p key={i} className="font-mono text-[10px] text-gh-textMuted">{f}: {reason}</p>
                  ))}
                </div>
              )}

              {/* Missing deps */}
              {projectVerification.missing_deps?.length > 0 && (
                <div className="p-2.5 bg-gh-surface border border-gh-border rounded-xl">
                  <p className="text-[11px] font-semibold text-gh-textMuted mb-1">Missing Dependencies ({projectVerification.missing_deps.length})</p>
                  {projectVerification.missing_deps.slice(0, 5).map((m, i) => (
                    <p key={i} className="font-mono text-[10px] text-gh-textMuted">{m.source} → {m.target}: {m.issue}</p>
                  ))}
                </div>
              )}

              {/* Full report text */}
              {projectVerification.report_text && (
                <div className="font-mono text-[10px] text-gh-textSubtle whitespace-pre-wrap p-2 bg-gh-bg border border-gh-border rounded-xl leading-relaxed">
                  {projectVerification.report_text}
                </div>
              )}

              {/* AI Disclaimer — subtle, small */}
              <div className="px-2 py-1.5 bg-gh-surface/50 border border-gh-border/60 rounded-lg text-[10px] text-gh-textSubtle italic">
                ⚠ AI-generated code can contain mistakes. Please verify the converted project and review the results before accepting.
              </div>
            </div>
          )
        )}

        {/* ── Pipeline Output ───────────────────────────────────────────────── */}
        {activeBottomTab === 'pipeline-output' && (
          projectPipelineStatus === 'idle' && projectPipelineLog.length === 0 ? (
            <Empty message="Run project pipeline to see execution output" />
          ) : (
            <div className="flex gap-4 h-full min-h-0 overflow-hidden animate-fadeIn">
              {/* Left: Routine Status Grid */}
              <div className="w-1/3 flex flex-col border-r border-gh-border pr-4 overflow-y-auto">
                <h4 className="text-[11px] font-semibold text-gh-textSubtle uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Project Routines</span>
                  <span className="text-[10px] text-gh-accent font-mono capitalize">({projectPipelineStatus})</span>
                </h4>
                <div className="flex flex-col gap-1">
                  {routines.map(r => {
                    const status = routineStatuses[r.id] || 'pending';
                    return (
                      <div key={r.id} className="flex items-center justify-between py-1 px-2 hover:bg-gh-surface/30 rounded text-[11px] font-mono">
                        <span className="truncate text-gh-textMuted">{r.name}.m</span>
                        <span>
                          {status === 'completed' && <span className="text-gh-green font-semibold">✓ Done</span>}
                          {status === 'analyzing' && <span className="text-gh-yellow animate-pulse">⟳ Analyzing...</span>}
                          {status === 'converting' && <span className="text-gh-accent animate-pulse">⟳ AI Converting...</span>}
                          {status === 'failed' && <span className="text-gh-red font-semibold">✗ Failed</span>}
                          {status === 'pending' && <span className="text-gh-textSubtle">○ Waiting</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Right: Console log */}
              <div className="flex-1 flex flex-col min-h-0 h-full">
                <h4 className="text-[11px] font-semibold text-gh-textSubtle uppercase tracking-wider mb-2">Console Output Log</h4>
                <div className="flex-1 bg-gh-bg border border-gh-border rounded-xl p-3 font-mono text-[10px] text-gh-textMuted overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                  {projectPipelineLog.length === 0 ? (
                    <span className="text-gh-textSubtle italic">Initializing pipeline...</span>
                  ) : (
                    projectPipelineLog.join('\n')
                  )}
                </div>
              </div>
            </div>
          )
        )}
=======
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
      </div>
    </div>
  );
}
