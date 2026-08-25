import React from 'react';
import logoImg from '../assets/temp_image_1786523047062.jpeg';

export default function StartupLandingPage({ onGoToWorkspace }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0d1117] text-[#e6edf3] select-none animate-fadeIn overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 40%, rgba(56, 139, 253, 0.12) 0%, transparent 60%),
          radial-gradient(circle at 50% 60%, rgba(163, 113, 247, 0.08) 0%, transparent 60%)
        `
      }}
    >
      {/* Centered Content Container */}
      <div className="flex flex-col items-center text-center px-6 max-w-xl animate-fadeInScale">
        
        {/* Animated ErrorX404 Logo */}
        <div className="animate-logo-float mb-6">
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl overflow-hidden p-[2px] bg-gradient-to-br from-[#388bfd] via-[#a371f7] to-[#1f6feb] animate-logo-pulse">
            <div className="w-full h-full rounded-[22px] overflow-hidden bg-[#0d1117] flex items-center justify-center">
              <img
                src={logoImg}
                alt="ErrorX404"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3 font-sans">
          Error<span className="text-[#388bfd]">X</span>404
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-[#8b949e] font-normal mb-8 max-w-md leading-relaxed">
          Legacy Code Intelligence and Modernization Platform
        </p>

        {/* Prominent Action Button */}
        <button
          onClick={onGoToWorkspace}
          className="group relative inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#1f6feb] to-[#388bfd] hover:from-[#388bfd] hover:to-[#58a6ff] text-white font-semibold text-base shadow-[0_4px_20px_rgba(56,139,253,0.35)] hover:shadow-[0_6px_28px_rgba(56,139,253,0.5)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <span>→ Go to Workspace</span>
        </button>

      </div>
    </div>
  );
}
