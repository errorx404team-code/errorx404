import React, { useState, useEffect } from 'react';

const STAGES = [
  { id: 0, title: 'ErrorX404', desc: 'Initializing Modernization Engine', progress: 18, color: '#388bfd' },
  { id: 1, title: 'Analyzing Legacy Code', desc: 'Parsing MUMPS Routines & Globals', progress: 42, color: '#f0883e' },
  { id: 2, title: 'AI Modernization', desc: 'Neural Dependency Graph & AST Synthesis', progress: 74, color: '#a371f7' },
  { id: 3, title: 'Generating Modern Code', desc: 'Emitting Python Clean Architecture', progress: 95, color: '#3fb950' },
  { id: 4, title: 'Loading Workspace', desc: 'Ready for Development', progress: 100, color: '#58a6ff' },
];

const MUMPS_SNIPPET = [
  'ROUTINE^LEGACY(ARG1,ARG2)',
  '  ; Auto-legacy routine parser',
  '  SET ^GLOBAL(ID)=$GET(DATA)',
  '  IF $DATA(^GLOBAL(ID)) DO',
  '  . NEW STATUS,TEMP',
  '  . SET STATUS=$$VALID^CHK(ID)',
  '  . QUIT:STATUS<0',
  '  . WRITE !,"STATUS:",STATUS',
  '  QUIT 1'
];

const PYTHON_SNIPPET = [
  'from dataclasses import dataclass',
  'from typing import Optional',
  '',
  '@dataclass(slots=True)',
  'class ModernizedEntity:',
  '    entity_id: str',
  '    status_code: int',
  '',
  'async def process_modern(arg1: str, arg2: dict) -> ModernizedEntity:',
  '    """Modernized from legacy MUMPS core routine"""',
  '    if not await validate_record(arg1):',
  '        raise RecordValidationError(arg1)',
  '    return ModernizedEntity(entity_id=arg1, status_code=200)'
];

export default function ModernizationLoader({ onComplete }) {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [progress, setProgress] = useState(10);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [activeCodeLine, setActiveCodeLine] = useState(0);

  useEffect(() => {
    // Sequence timing through stages: ~2.4s total for a rich yet brisk feel
    const timeline = [
      { delay: 350, stage: 1, p: 38 },
      { delay: 900, stage: 2, p: 68 },
      { delay: 1550, stage: 3, p: 92 },
      { delay: 2150, stage: 4, p: 100 },
      { delay: 2600, fade: true },
      { delay: 2950, finish: true },
    ];

    const timers = timeline.map(item => {
      return setTimeout(() => {
        if (item.stage !== undefined) {
          setCurrentStageIdx(item.stage);
          setProgress(item.p);
        }
        if (item.fade) {
          setIsFadingOut(true);
        }
        if (item.finish) {
          onComplete?.();
        }
      }, item.delay);
    });

    // Code line scan animation interval
    const codeInterval = setInterval(() => {
      setActiveCodeLine(prev => (prev + 1) % 9);
    }, 180);

    // Error-safe fallback guarantee: never block after 4.5 seconds
    const fallbackTimer = setTimeout(() => {
      onComplete?.();
    }, 4500);

    return () => {
      timers.forEach(t => clearTimeout(t));
      clearInterval(codeInterval);
      clearTimeout(fallbackTimer);
    };
  }, [onComplete]);

  const currentStage = STAGES[currentStageIdx] || STAGES[0];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090d13] text-[#e6edf3] select-none transition-opacity duration-300 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 20%, rgba(56, 139, 253, 0.12) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(163, 113, 247, 0.08) 0%, transparent 45%),
          radial-gradient(circle at 20% 80%, rgba(63, 185, 80, 0.06) 0%, transparent 45%)
        `
      }}
    >
      {/* Background ambient grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'linear-gradient(to right, #30363d 1px, transparent 1px), linear-gradient(to bottom, #30363d 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      <div className="relative z-10 w-full max-w-3xl px-6 flex flex-col items-center">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-2 animate-fadeIn">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[#1f6feb] via-[#388bfd] to-[#a371f7] p-[1.5px] shadow-[0_0_25px_rgba(56,139,253,0.4)]">
            <div className="w-full h-full bg-[#0d1117] rounded-[10px] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#58a6ff]">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#bolt-grad)" stroke="#388bfd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <defs>
                  <linearGradient id="bolt-grad" x1="3" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#388bfd" stopOpacity="0.8"/>
                    <stop offset="1" stopColor="#a371f7" stopOpacity="0.9"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
                Error<span className="text-[#388bfd]">X</span>404
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#388bfd]/15 text-[#58a6ff] border border-[#388bfd]/30 uppercase tracking-wider">
                AI Modernizer
              </span>
            </div>
            <p className="text-xs text-[#8b949e] font-mono">Legacy Code Intelligence & Modernization Platform</p>
          </div>
        </div>

        {/* Transformation Visual Stage: Legacy → AI → Modern */}
        <div className="w-full mt-6 mb-6 p-4 rounded-xl bg-[#161b22]/90 border border-[#30363d]/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            
            {/* Left Box: Legacy MUMPS */}
            <div className="md:col-span-5 bg-[#0d1117] rounded-lg p-3 border border-[#f0883e]/30 shadow-inner flex flex-col h-[180px] overflow-hidden relative">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#30363d] text-[11px]">
                <div className="flex items-center gap-1.5 font-mono text-[#f0883e] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#f0883e] animate-ping" />
                  MUMPS Legacy AST
                </div>
                <span className="text-[10px] text-[#8b949e] font-mono">routine.m</span>
              </div>
              <div className="font-mono text-[11px] leading-relaxed text-[#8b949e] flex-1 overflow-hidden space-y-0.5">
                {MUMPS_SNIPPET.map((line, idx) => (
                  <div 
                    key={idx} 
                    className={`transition-colors duration-150 flex items-center px-1 rounded ${
                      currentStageIdx >= 1 && activeCodeLine % MUMPS_SNIPPET.length === idx 
                        ? 'bg-[#f0883e]/15 text-[#ffa657] font-semibold' 
                        : ''
                    }`}
                  >
                    <span className="w-4 text-[9px] text-[#6e7681] select-none">{idx + 1}</span>
                    <span className="truncate">{line}</span>
                  </div>
                ))}
              </div>
              {/* Scanline light effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f0883e]/5 to-transparent pointer-events-none animate-pulse" />
            </div>

            {/* Center Transformation Node: AI Bridge */}
            <div className="md:col-span-1 flex flex-col items-center justify-center py-1">
              <div className="relative flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-[#1c2128] border border-[#a371f7]/50 flex items-center justify-center shadow-[0_0_15px_rgba(163,113,247,0.4)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a371f7" strokeWidth="2" className="animate-spin" style={{ animationDuration: '4s' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                </div>
                {/* Connecting glowing pulses */}
                <div className="absolute -left-3 w-3 h-0.5 bg-gradient-to-r from-[#f0883e] to-[#a371f7]" />
                <div className="absolute -right-3 w-3 h-0.5 bg-gradient-to-r from-[#a371f7] to-[#3fb950]" />
              </div>
              <span className="mt-1.5 text-[9px] font-mono font-bold text-[#a371f7] tracking-wider uppercase">
                AI Pipeline
              </span>
            </div>

            {/* Right Box: Modern Python */}
            <div className="md:col-span-5 bg-[#0d1117] rounded-lg p-3 border border-[#3fb950]/30 shadow-inner flex flex-col h-[180px] overflow-hidden relative">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#30363d] text-[11px]">
                <div className="flex items-center gap-1.5 font-mono text-[#3fb950] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
                  Target Architecture
                </div>
                <span className="text-[10px] text-[#8b949e] font-mono">modern_service.py</span>
              </div>
              <div className="font-mono text-[11px] leading-relaxed text-[#8b949e] flex-1 overflow-hidden space-y-0.5">
                {PYTHON_SNIPPET.map((line, idx) => (
                  <div 
                    key={idx} 
                    className={`transition-colors duration-150 flex items-center px-1 rounded ${
                      currentStageIdx >= 3 && activeCodeLine % PYTHON_SNIPPET.length === idx 
                        ? 'bg-[#3fb950]/15 text-[#7ee787] font-semibold' 
                        : ''
                    }`}
                  >
                    <span className="w-4 text-[9px] text-[#6e7681] select-none">{idx + 1}</span>
                    <span className="truncate">{line}</span>
                  </div>
                ))}
              </div>
              {/* Scanline light effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#3fb950]/5 to-transparent pointer-events-none animate-pulse" />
            </div>

          </div>
        </div>

        {/* Step Sequence Indicators */}
        <div className="w-full grid grid-cols-5 gap-2 mb-4">
          {STAGES.map((st, idx) => {
            const isPassed = currentStageIdx > idx;
            const isCurrent = currentStageIdx === idx;
            return (
              <div 
                key={st.id} 
                className={`flex flex-col items-center text-center p-2 rounded-lg transition-all duration-300 border ${
                  isCurrent 
                    ? 'bg-[#21262d] border-[#58a6ff]/60 shadow-[0_0_12px_rgba(56,139,253,0.25)] translate-y-[-2px]' 
                    : isPassed
                    ? 'bg-[#161b22]/70 border-[#3fb950]/40 opacity-90'
                    : 'bg-[#161b22]/30 border-[#30363d]/40 opacity-40'
                }`}
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full mb-1 text-[10px] font-mono font-bold">
                  {isPassed ? (
                    <span className="text-[#3fb950]">✓</span>
                  ) : isCurrent ? (
                    <span className="text-[#58a6ff] animate-pulse">●</span>
                  ) : (
                    <span className="text-[#6e7681]">{idx + 1}</span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-[#e6edf3] truncate w-full">
                  {st.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status Text & Progress Bar */}
        <div className="w-full flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: currentStage.color }} />
              <span className="font-medium text-[#e6edf3]">{currentStage.title}:</span>
              <span className="text-[#8b949e] font-mono">{currentStage.desc}</span>
            </div>
            <span className="font-mono text-xs font-semibold text-[#58a6ff]">{progress}%</span>
          </div>

          {/* Glowing Progress Track */}
          <div className="w-full h-2 bg-[#21262d] rounded-full overflow-hidden border border-[#30363d]/60 relative">
            <div
              className="h-full transition-all duration-300 ease-out relative"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #388bfd 0%, #a371f7 50%, #3fb950 100%)',
                boxShadow: '0 0 10px rgba(56, 139, 253, 0.5)'
              }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>
        </div>

        {/* Instant Skip / Quick Proceed Button */}
        <button
          onClick={() => {
            setIsFadingOut(true);
            setTimeout(() => onComplete?.(), 150);
          }}
          className="mt-6 text-[11px] text-[#6e7681] hover:text-[#e6edf3] transition-colors flex items-center gap-1 font-mono hover:underline cursor-pointer"
        >
          <span>Skip to IDE workspace</span>
          <span>→</span>
        </button>

      </div>
    </div>
  );
}
