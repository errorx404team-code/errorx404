import React from 'react';
import { RefreshCw, Key, Zap, Files } from 'lucide-react';

export default function StatusBar({
  activeRoutine,
  targetLang,
  isProcessing,
  pipelineStep,
  reviewCounts,
  apiKeyStatus,
  onOpenSettings,
  totalRoutines = 0,
  uploadQueueTotal = 0,
  uploadQueueIndex = 0,
}) {
  const hasKey = apiKeyStatus?.has_key;
  const isUploading = uploadQueueTotal > 0 && uploadQueueIndex < uploadQueueTotal;

  return (
    <div className="h-6 bg-gh-accentEmphasis text-white px-3 flex justify-between items-center text-[11px] font-mono select-none shrink-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-semibold opacity-90">
          <Zap size={11} strokeWidth={2.5} />
          <span>VistA Modernizer</span>
        </div>

        {/* Active file breadcrumb */}
        {activeRoutine && !isProcessing && !isUploading && (
          <div className="flex items-center gap-1 opacity-80">
            <span className="opacity-60">›</span>
            <span>{activeRoutine.name}.m</span>
            <span className="opacity-50 mx-1">→</span>
            <span className="text-green-200">{targetLang}</span>
          </div>
        )}

        {/* Pipeline running */}
        {isProcessing && !isUploading && (
          <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded animate-pulse">
            <RefreshCw size={10} className="animate-spin" />
            <span className="text-[10px]">{pipelineStep || 'Running…'}</span>
          </div>
        )}

        {/* Upload queue progress */}
        {isUploading && (
          <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <span className="text-[10px]">
              Uploading {uploadQueueIndex + 1}/{uploadQueueTotal} files
            </span>
            {activeRoutine && (
              <span className="opacity-60 text-[10px]">— {activeRoutine.name}.m</span>
            )}
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* File count */}
        <div className="flex items-center gap-1 opacity-70">
          <Files size={10} />
          <span className="text-[10px]">{totalRoutines} {totalRoutines === 1 ? 'routine' : 'routines'}</span>
        </div>

        {/* Review counts */}
        <div className="flex items-center gap-1.5 opacity-80">
          <span className="bg-green-500/30 text-green-200 px-1.5 py-px rounded text-[10px] font-semibold">{reviewCounts?.approved || 0} approved</span>
          <span className="bg-yellow-500/20 text-yellow-200 px-1.5 py-px rounded text-[10px] font-semibold">{reviewCounts?.pending || 0} pending</span>
          <span className="bg-red-500/20 text-red-200 px-1.5 py-px rounded text-[10px] font-semibold">{reviewCounts?.rejected || 0} rejected</span>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
          title="Configure Gemini API Key"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-green-300' : 'bg-yellow-300'}`} />
          <span className="font-semibold text-[10px]">
            {hasKey ? `Gemini AI Connected` : 'Fallback Mode'}
          </span>
          <Key size={9} className="opacity-60" />
        </button>
      </div>
    </div>
  );
}
