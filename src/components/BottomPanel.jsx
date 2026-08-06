import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Network, Layers, FileText, Cpu, Activity } from 'lucide-react';

export default function BottomPanel({
  activeBottomTab,
  setActiveBottomTab,
  verificationData,
  confidenceData,
  explainabilityData,
  dependencyData,
  partitionData,
  documentationData
}) {
  const tabs = [
    { id: 'verification', label: 'Verification', icon: CheckCircle2 },
    { id: 'confidence', label: 'Confidence', icon: ShieldCheck },
    { id: 'explainability', label: 'Explainability', icon: Activity },
    { id: 'dependency', label: 'Dependency Graph', icon: Network },
    { id: 'partitioning', label: 'Logic Map', icon: Layers },
    { id: 'docs', label: 'Docs', icon: FileText },
  ];

  const Empty = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
      <Cpu size={22} className="text-gh-textSubtle opacity-40" />
      <p className="text-xs text-gh-textSubtle">{message}</p>
    </div>
  );

  return (
    <div className="h-56 bg-gh-canvas border-t border-gh-border flex flex-col shrink-0 select-none">
      {/* Tab Header */}
      <div className="bg-gh-surface2 border-b border-gh-border flex justify-between items-center px-2 h-8 shrink-0">
        <div className="flex items-center">
          {tabs.map((t) => {
            const isActive = activeBottomTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveBottomTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-gh-accent text-gh-text bg-gh-canvas'
                    : 'border-transparent text-gh-textSubtle hover:text-gh-textMuted hover:bg-gh-surface/60'
                }`}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}
        </div>

        {confidenceData && (
          <div className="flex items-center gap-2 text-xs pr-3">
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
        {/* Verification */}
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
                            <span className="flex items-center gap-1 text-gh-green font-semibold">
                              <CheckCircle2 size={12} /> PASS
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gh-red font-semibold" title={r.mismatch_details}>
                              <XCircle size={12} /> FAIL
                            </span>
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

        {/* Confidence Score */}
        {activeBottomTab === 'confidence' && (
          !confidenceData ? (
            <Empty message="Run pipeline to calculate confidence score" />
          ) : (
            <div className="flex flex-col gap-3 max-w-2xl animate-fadeIn">
              <div className="p-3 bg-gh-surface rounded-xl border border-gh-border flex items-center gap-4">
                {/* Score ring */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#21262d" strokeWidth="3"/>
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
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
                    <span className={`${
                      confidenceData.category === 'safe' ? 'text-gh-green' :
                      confidenceData.category === 'needs_review' ? 'text-gh-yellow' :
                      'text-gh-red'
                    }`}>
                      {confidenceData.category.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gh-textMuted leading-relaxed text-[11px]">{confidenceData.reasoning_text}</p>
                </div>
              </div>
              <div className="p-2.5 bg-gh-bg rounded-xl border border-gh-border text-gh-textSubtle leading-relaxed font-mono text-[10px] space-y-1">
                <p className="text-gh-textMuted font-semibold text-xs mb-1">Score Formula</p>
                <p>• Verification Pass Rate × 0.6 (execution across test vectors)</p>
                <p>• Code Complexity × 0.2 (structural depth & safety)</p>
                <p>• Mismatch Severity × 0.2 (error drift penalty)</p>
              </div>
            </div>
          )
        )}

        {/* Explainability */}
        {activeBottomTab === 'explainability' && (
          !explainabilityData ? (
            <Empty message="Run pipeline to generate explainability trace" />
          ) : (
            <div className="flex flex-col gap-2 max-w-3xl animate-fadeIn">
              {explainabilityData.reasoning_trace.map((item, i) => (
                <div key={i} className="p-2.5 bg-gh-surface rounded-xl border border-gh-border flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-gh-accentEmphasis text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                    {item.step}
                  </div>
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
        {activeBottomTab === 'partitioning' && (
          !partitionData ? (
            <Empty message="Run pipeline for business logic partition analysis" />
          ) : (
            <div className="flex flex-col gap-3 animate-fadeIn">
              <div className="p-2.5 bg-gh-surface rounded-xl border border-gh-border flex justify-between items-center">
                <span className="text-[11px] text-gh-textMuted">
                  Overall Cohesion: <span className="text-gh-green font-bold text-sm">{partitionData.overall_cohesion}%</span>
                </span>
                <span className="text-[10px] text-gh-textSubtle italic">Mono2Micro-inspired</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {partitionData.partitions.map((p, i) => (
                  <div key={i} className="p-3 bg-gh-bg border border-gh-border rounded-xl flex flex-col gap-2">
                    <h4 className="font-semibold text-gh-text text-[11px]">{p.partition_name}</h4>
                    <div className="text-[10px] text-gh-textSubtle font-mono truncate">
                      <span className="text-gh-accent">{p.member_functions.join(', ')}</span>
                    </div>
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

        {/* Migration Docs */}
        {activeBottomTab === 'docs' && (
          !documentationData ? (
            <Empty message="Run pipeline to generate technical documentation" />
          ) : (
            <div className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-gh-textMuted p-3 bg-gh-bg rounded-xl border border-gh-border animate-fadeIn">
              {documentationData.markdown_docs}
            </div>
          )
        )}
      </div>
    </div>
  );
}
