import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, AlertTriangle, CheckCircle, BarChart2, RefreshCw,
  ChevronDown, ChevronRight, Send, Bot, User, Shield, Zap,
  Code2, MessageSquare, Eye, Briefcase, Terminal
} from 'lucide-react';

// ── View level tab ─────────────────────────────────────────────────────────
const VIEW_LEVELS = [
  { id: 'simple', label: 'Simple', icon: Eye, desc: 'Plain English for anyone' },
  { id: 'business', label: 'Business', icon: Briefcase, desc: 'Business logic & rules' },
  { id: 'technical', label: 'Technical', icon: Terminal, desc: 'Full technical detail' },
];

function SectionToggle({ title, icon: Icon, children, defaultOpen = false, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gh-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gh-surface hover:bg-gh-surface2 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={12} className={accent || 'text-gh-accent'} />}
          <span className="text-xs font-semibold text-gh-text">{title}</span>
        </div>
        {open ? <ChevronDown size={12} className="text-gh-textSubtle" /> : <ChevronRight size={12} className="text-gh-textSubtle" />}
      </button>
      {open && <div className="px-3 pb-3 pt-2 bg-gh-bg text-xs text-gh-textMuted">{children}</div>}
    </div>
  );
}

function RiskBadge({ category, score }) {
  const cfg = {
    safe: { cls: 'bg-gh-greenBg text-gh-green border-gh-greenDim/30', dot: 'bg-gh-green' },
    needs_review: { cls: 'bg-gh-yellowBg text-gh-yellow border-gh-yellow/30', dot: 'bg-gh-yellow' },
    failed: { cls: 'bg-gh-redBg text-gh-red border-gh-red/20', dot: 'bg-gh-red' },
  };
  const c = cfg[category] || cfg.safe;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {score?.toFixed(0)}% · {(category || '').replace('_', ' ').toUpperCase()}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const m = {
    critical: 'bg-gh-redBg text-gh-red border-gh-red/20',
    high: 'bg-gh-redBg text-gh-red border-gh-red/20',
    medium: 'bg-gh-yellowBg text-gh-yellow border-gh-yellow/30',
    low: 'bg-gh-greenBg text-gh-green border-gh-greenDim/20',
  };
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${m[severity] || m.low} uppercase`}>
      {severity}
    </span>
  );
}

// ── Inline Q&A Chatlet ──────────────────────────────────────────────────────
function InlineChatlet({ conversionId, explanationLevel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversions/${conversionId}/human-explanation/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversion_id: conversionId, question: q, explanation_level: explanationLevel }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', text: data.answer, evidence: data.evidence }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry — could not answer that question. Please try again.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Backend unreachable.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQs = [
    'What does this routine do?',
    'What are the business rules?',
    'Why is the confidence score this level?',
    'What changed from MUMPS to Python?',
  ];

  return (
    <div className="flex flex-col border border-gh-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gh-surface border-b border-gh-border">
        <MessageSquare size={11} className="text-gh-purple" />
        <span className="text-[11px] font-semibold text-gh-text">Ask about this conversion</span>
        <span className="ml-auto text-[9px] text-gh-textSubtle italic">evidence-backed · no hallucinations</span>
      </div>

      {messages.length === 0 && (
        <div className="px-3 py-2 grid grid-cols-2 gap-1.5">
          {quickQs.map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              className="text-left text-[10px] px-2 py-1.5 bg-gh-bg hover:bg-gh-surface border border-gh-border rounded-lg text-gh-textMuted hover:text-gh-text transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="max-h-48 overflow-y-auto p-3 flex flex-col gap-2 bg-gh-bg">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-5 h-5 rounded-md bg-gh-purple/20 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={10} className="text-purple-400" />
                </div>
              )}
              <div className="flex flex-col gap-1 max-w-[85%]">
                <div className={`text-[11px] leading-relaxed rounded-xl px-2.5 py-1.5 whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-gh-accentEmphasis text-white rounded-br-sm'
                    : 'bg-gh-surface border border-gh-border text-gh-text rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
                {m.evidence?.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {m.evidence.slice(0, 3).map((ev, ei) => (
                      <span key={ei} className="text-[9px] px-1.5 py-0.5 bg-gh-surface2 border border-gh-border rounded text-gh-textSubtle font-mono">
                        {ev.reference}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-5 h-5 rounded-md bg-gh-surface border border-gh-border flex items-center justify-center shrink-0 mt-0.5">
                  <User size={10} className="text-gh-textMuted" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 text-gh-textSubtle">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={send} className="flex gap-2 p-2 border-t border-gh-border bg-gh-canvas">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question about this code…"
          className="flex-1 bg-gh-bg border border-gh-border rounded-lg px-3 py-1.5 text-xs text-gh-text placeholder:text-gh-textSubtle focus:outline-none focus:border-gh-accent focus:ring-1 focus:ring-gh-accent/20 transition-all"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 transition-all"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function HumanUnderstandingPanel({ conversion, activeRoutine }) {
  const [viewLevel, setViewLevel] = useState('business');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const conversionId = conversion?.id;

  const loadExplanation = async (forceRegen = false) => {
    if (!conversionId) return;
    if (forceRegen) {
      setRegenerating(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const url = forceRegen
        ? `/api/conversions/${conversionId}/human-explanation/regenerate`
        : `/api/conversions/${conversionId}/human-explanation`;
      const res = await fetch(url, { method: forceRegen ? 'POST' : 'GET' });
      if (res.ok) {
        setData(await res.json());
      } else {
        setError('Failed to load explanation. Run the pipeline first.');
      }
    } catch {
      setError('Backend unreachable — check the server is running.');
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (conversionId) {
      setData(null);
      loadExplanation(false);
    }
  }, [conversionId]);

  if (!conversion) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-6">
        <BookOpen size={22} className="text-gh-textSubtle opacity-40" />
        <p className="text-xs text-gh-textSubtle">Run the pipeline to generate a human-readable explanation</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <p className="text-xs text-gh-textMuted">Generating human-readable explanation…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <AlertTriangle size={20} className="text-gh-yellow" />
        <p className="text-xs text-gh-textMuted">{error}</p>
        <button onClick={() => loadExplanation(false)} className="text-xs px-3 py-1.5 bg-gh-surface border border-gh-border text-gh-textMuted hover:text-gh-text rounded-lg transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const exp = data?.structured_explanation;
  if (!exp) return null;

  const conf = exp.confidence_explanation;
  const ver = exp.verification_summary;
  const cs = exp.conversion_summary;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gh-border bg-gh-surface2 shrink-0">
        <div className="flex items-center gap-2.5">
          <BookOpen size={13} className="text-gh-accent" />
          <div>
            <p className="text-xs font-semibold text-gh-text truncate max-w-[280px]" title={exp.title}>{exp.title}</p>
            <p className="text-[10px] text-gh-textSubtle">{exp.who_is_this_for}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RiskBadge category={conf?.category} score={conf?.score} />
          <button
            onClick={() => loadExplanation(true)}
            disabled={regenerating}
            title="Regenerate explanation"
            className="flex items-center gap-1 px-2 py-1 bg-gh-surface hover:bg-gh-surface2 border border-gh-border rounded-lg text-[10px] text-gh-textMuted hover:text-gh-text transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* View Level Tabs */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 bg-gh-canvas border-b border-gh-border shrink-0">
        {VIEW_LEVELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setViewLevel(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              viewLevel === id
                ? 'bg-gh-accent text-white'
                : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-surface'
            }`}
          >
            <Icon size={10} />
            {label}
          </button>
        ))}
        <span className="ml-auto text-[9px] text-gh-textSubtle italic">Evidence-based · fallback-safe</span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

        {/* ── Simple View ── */}
        {viewLevel === 'simple' && (
          <>
            {/* One-line summary card */}
            <div className="p-3 bg-gh-surface rounded-xl border border-gh-border">
              <p className="text-xs font-semibold text-gh-text mb-1">What does this do?</p>
              <p className="text-[12px] leading-relaxed text-gh-textMuted">{exp.one_line_summary}</p>
            </div>

            {/* Executive summary */}
            <div className="p-3 bg-gh-bg rounded-xl border border-gh-border">
              <p className="text-xs font-semibold text-gh-text mb-2 flex items-center gap-1.5">
                <Zap size={10} className="text-gh-yellow" /> Executive Summary
              </p>
              <p className="text-[11px] leading-relaxed text-gh-textMuted whitespace-pre-line">{exp.executive_summary}</p>
            </div>

            {/* Confidence simple indicator */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              conf?.category === 'safe' ? 'bg-gh-greenBg border-gh-greenDim/30' :
              conf?.category === 'needs_review' ? 'bg-gh-yellowBg border-gh-yellow/30' :
              'bg-gh-redBg border-gh-red/20'
            }`}>
              <Shield size={18} className={conf?.category === 'safe' ? 'text-gh-green' : conf?.category === 'needs_review' ? 'text-gh-yellow' : 'text-gh-red'} />
              <div>
                <p className="text-xs font-semibold text-gh-text">{conf?.human_explanation}</p>
                <p className="text-[10px] text-gh-textMuted mt-0.5">{conf?.recommended_action}</p>
              </div>
            </div>

            {/* Verification simple */}
            <div className="flex items-center gap-3 p-3 bg-gh-surface rounded-xl border border-gh-border">
              <CheckCircle size={16} className={ver?.tests_failed === 0 ? 'text-gh-green' : 'text-gh-red'} />
              <div>
                <p className="text-xs font-semibold text-gh-text">Tests: {ver?.tests_passed}/{ver?.tests_run} passed</p>
                <p className="text-[10px] text-gh-textMuted mt-0.5">{ver?.human_explanation}</p>
              </div>
            </div>

            {/* Warnings */}
            {exp.warnings?.filter(w => w.severity !== 'low').length > 0 && (
              <SectionToggle title={`Warnings (${exp.warnings.filter(w => w.severity !== 'low').length})`} icon={AlertTriangle} accent="text-gh-yellow" defaultOpen>
                <div className="flex flex-col gap-2">
                  {exp.warnings.filter(w => w.severity !== 'low').map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <SeverityBadge severity={w.severity} />
                      <p className="text-[11px] leading-relaxed">{w.human_explanation}</p>
                    </div>
                  ))}
                </div>
              </SectionToggle>
            )}

            <InlineChatlet conversionId={conversionId} explanationLevel="simple" />
          </>
        )}

        {/* ── Business View ── */}
        {viewLevel === 'business' && (
          <>
            {/* Business Purpose */}
            <div className="p-3 bg-gh-surface rounded-xl border border-gh-border">
              <p className="text-[10px] font-semibold text-gh-accent uppercase tracking-wide mb-1">Business Purpose</p>
              <p className="text-xs leading-relaxed text-gh-text">{exp.business_purpose}</p>
            </div>

            {/* Inputs & Outputs row */}
            <div className="grid grid-cols-2 gap-3">
              <SectionToggle title={`Inputs (${exp.inputs?.length || 0})`} icon={Code2} defaultOpen>
                {exp.inputs?.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {exp.inputs.map((inp, i) => (
                      <div key={i} className="p-1.5 bg-gh-surface border border-gh-border rounded-lg">
                        <p className="font-mono text-[10px] text-gh-accent font-semibold">{inp.name}</p>
                        <p className="text-[10px] text-gh-textMuted mt-0.5">{inp.meaning}</p>
                        {inp.example && <p className="text-[9px] text-gh-textSubtle mt-0.5 font-mono">e.g. {inp.example}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-gh-textSubtle italic">No inputs documented</p>}
              </SectionToggle>

              <SectionToggle title={`Outputs (${exp.outputs?.length || 0})`} icon={BarChart2} defaultOpen>
                {exp.outputs?.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {exp.outputs.map((out, i) => (
                      <div key={i} className="p-1.5 bg-gh-surface border border-gh-border rounded-lg">
                        <p className="font-mono text-[10px] text-gh-green font-semibold">{out.name}</p>
                        <p className="text-[10px] text-gh-textMuted mt-0.5">{out.meaning}</p>
                        {out.example && <p className="text-[9px] text-gh-textSubtle mt-0.5 font-mono">e.g. {out.example}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[11px] text-gh-textSubtle italic">No outputs documented</p>}
              </SectionToggle>
            </div>

            {/* Workflow Steps */}
            <SectionToggle title="Workflow Steps" icon={Zap} accent="text-gh-purple" defaultOpen>
              <ol className="flex flex-col gap-2">
                {exp.workflow?.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gh-accentEmphasis text-white text-[9px] font-bold flex items-center justify-center shrink-0">{step.step}</span>
                    <div>
                      <p className="text-[11px] font-semibold text-gh-text">{step.action}</p>
                      <p className="text-[11px] text-gh-textMuted">{step.business_meaning}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionToggle>

            {/* Business Rules */}
            <SectionToggle title={`Business Rules (${exp.business_rules?.length || 0})`} icon={Shield} accent="text-gh-orange" defaultOpen={exp.business_rules?.length > 0}>
              <div className="flex flex-col gap-2">
                {exp.business_rules?.map((rule, i) => (
                  <div key={i} className="p-2 bg-gh-surface border border-gh-border rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono text-gh-orange bg-gh-surface border border-gh-orange/20 px-1.5 py-0.5 rounded">{rule.rule_id}</span>
                      <span className="text-[10px] font-mono text-gh-textSubtle truncate">{rule.technical_rule}</span>
                    </div>
                    <p className="text-[11px] text-gh-text">{rule.human_explanation}</p>
                    <p className="text-[10px] text-gh-textSubtle mt-0.5 italic">Why it matters: {rule.why_it_matters}</p>
                  </div>
                ))}
              </div>
            </SectionToggle>

            {/* Decisions */}
            {exp.decisions?.length > 0 && (
              <SectionToggle title={`Decision Points (${exp.decisions.length})`} icon={BarChart2}>
                <div className="flex flex-col gap-2">
                  {exp.decisions.map((d, i) => (
                    <div key={i} className="p-2 bg-gh-bg border border-gh-border rounded-lg">
                      <p className="text-[11px] font-semibold text-gh-text mb-1">If: {d.condition}</p>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="p-1.5 bg-gh-greenBg border border-gh-greenDim/20 rounded">
                          <p className="text-gh-green font-semibold text-[9px] mb-0.5">✓ TRUE</p>
                          <p className="text-gh-textMuted">{d.if_true}</p>
                        </div>
                        <div className="p-1.5 bg-gh-redBg border border-gh-red/20 rounded">
                          <p className="text-gh-red font-semibold text-[9px] mb-0.5">✗ FALSE</p>
                          <p className="text-gh-textMuted">{d.if_false}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gh-textSubtle mt-1 italic">{d.human_explanation}</p>
                    </div>
                  ))}
                </div>
              </SectionToggle>
            )}

            {/* Error Handling */}
            {exp.error_handling?.length > 0 && (
              <SectionToggle title={`Error Handling (${exp.error_handling.length})`} icon={AlertTriangle} accent="text-gh-red">
                <div className="flex flex-col gap-1.5">
                  {exp.error_handling.map((e, i) => (
                    <div key={i} className="p-2 bg-gh-bg border border-gh-border rounded-lg">
                      <p className="text-[11px] font-semibold text-gh-text">{e.scenario}</p>
                      <p className="text-[10px] text-gh-textMuted mt-0.5">{e.human_explanation}</p>
                    </div>
                  ))}
                </div>
              </SectionToggle>
            )}

            <InlineChatlet conversionId={conversionId} explanationLevel="business" />
          </>
        )}

        {/* ── Technical View ── */}
        {viewLevel === 'technical' && (
          <>
            {/* Conversion Summary */}
            <div className="p-3 bg-gh-surface rounded-xl border border-gh-border">
              <p className="text-xs font-semibold text-gh-text mb-2">
                {cs?.old_technology} → {cs?.new_technology} Modernization
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-[10px] text-gh-textSubtle font-semibold uppercase tracking-wide mb-1">What Changed</p>
                  <p className="text-gh-textMuted leading-relaxed">{cs?.what_changed}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gh-textSubtle font-semibold uppercase tracking-wide mb-1">What Was Preserved</p>
                  <p className="text-gh-textMuted leading-relaxed">{cs?.what_was_preserved}</p>
                </div>
              </div>
            </div>

            {/* Before/After Comparison */}
            {exp.before_after_comparison?.length > 0 && (
              <SectionToggle title="Before / After Code Comparison" icon={Code2} defaultOpen>
                <div className="flex flex-col gap-2">
                  {exp.before_after_comparison.map((cmp, i) => (
                    <div key={i} className="rounded-lg border border-gh-border overflow-hidden">
                      <div className="grid grid-cols-2">
                        <div className="p-2 border-r border-gh-border">
                          <p className="text-[9px] text-gh-yellow font-semibold mb-1 uppercase">MUMPS</p>
                          <pre className="text-[10px] font-mono text-gh-text whitespace-pre-wrap break-words">{cmp.legacy_mumps}</pre>
                        </div>
                        <div className="p-2">
                          <p className="text-[9px] text-gh-green font-semibold mb-1 uppercase">Python</p>
                          <pre className="text-[10px] font-mono text-gh-text whitespace-pre-wrap break-words">{cmp.modern_python}</pre>
                        </div>
                      </div>
                      <div className="px-2 py-1.5 border-t border-gh-border bg-gh-surface2 text-[10px] text-gh-textSubtle italic">
                        {cmp.human_meaning}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionToggle>
            )}

            {/* Data Usage */}
            {exp.data_usage?.length > 0 && (
              <SectionToggle title={`Data Usage (${exp.data_usage.length})`} icon={Terminal}>
                <div className="flex flex-col gap-1.5">
                  {exp.data_usage.map((du, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 bg-gh-surface border border-gh-border rounded-lg">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border font-mono ${
                        du.technical_operation === 'READ' ? 'text-gh-accent bg-gh-accentEmphasis/10 border-gh-accent/20' :
                        du.technical_operation === 'WRITE' ? 'text-gh-yellow bg-gh-yellowBg border-gh-yellow/20' :
                        'text-gh-red bg-gh-redBg border-gh-red/20'
                      }`}>
                        {du.technical_operation}
                      </span>
                      <div>
                        <p className="text-[10px] font-mono text-gh-text font-semibold">{du.data_source}</p>
                        <p className="text-[10px] text-gh-textMuted">{du.human_meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionToggle>
            )}

            {/* Technical Terms Glossary */}
            {exp.technical_terms?.length > 0 && (
              <SectionToggle title="Technical Terms Glossary" icon={BookOpen}>
                <div className="flex flex-col gap-1">
                  {exp.technical_terms.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-gh-border/40 last:border-0">
                      <code className="text-[10px] text-gh-purple font-mono w-20 shrink-0">{t.term}</code>
                      <div>
                        <p className="text-[10px] text-gh-text font-semibold">{t.simple_meaning}</p>
                        <p className="text-[9px] text-gh-textSubtle">{t.technical_meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionToggle>
            )}

            {/* Human Summary */}
            <div className="p-3 bg-gh-bg rounded-xl border border-gh-border">
              <p className="text-[10px] font-semibold text-gh-textMuted uppercase tracking-wide mb-1.5">Full Human Summary</p>
              <p className="text-[11px] leading-relaxed text-gh-textMuted">{exp.human_summary}</p>
            </div>

            {/* AI Disclaimer */}
            <div className="px-3 py-2 bg-gh-surface2/50 border border-gh-border/60 rounded-lg text-[10px] text-gh-textSubtle italic">
              ⚠ Explanations are generated by AI from source evidence. Verify business logic independently before production deployment.
            </div>

            <InlineChatlet conversionId={conversionId} explanationLevel="technical" />
          </>
        )}
      </div>
    </div>
  );
}
