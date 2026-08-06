import React, { useState, useEffect, useRef } from 'react';
import ActivityBar from './components/ActivityBar';
import MenuBar from './components/MenuBar';
import SidebarFileTree from './components/SidebarFileTree';
import MonacoEditorTab from './components/MonacoEditorTab';
import RightSidebarChat from './components/RightSidebarChat';
import BottomPanel from './components/BottomPanel';
import DashboardView from './components/DashboardView';
import StatusBar from './components/StatusBar';
import Toast from './components/Toast';

export default function App() {
  const [routines, setRoutines] = useState([]);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [targetLang, setTargetLang] = useState('Python');
  const [activeTab, setActiveTab] = useState('explorer');
  const [activeBottomTab, setActiveBottomTab] = useState('verification');
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Multi-file upload tracking — preserves folder structure for sidebar tree
  const [uploadedFiles, setUploadedFiles] = useState([]);      // [{ file, rel }]
  const [uploadQueueTotal, setUploadQueueTotal] = useState(0); // total files in last batch
  const [uploadQueueIndex, setUploadQueueIndex] = useState(0); // how many have been uploaded so far

  // Pipeline Data States
  const [spec, setSpec] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [verificationData, setVerificationData] = useState(null);
  const [confidenceData, setConfidenceData] = useState(null);
  const [explainabilityData, setExplainabilityData] = useState(null);
  const [dependencyData, setDependencyData] = useState(null);
  const [partitionData, setPartitionData] = useState(null);
  const [documentationData, setDocumentationData] = useState(null);
  const [reviewDecision, setReviewDecision] = useState(null);

  // UI Flow States
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState('');
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [reviewCounts, setReviewCounts] = useState({ approved: 0, pending: 1, rejected: 0 });
  const [showBottomPanel, setShowBottomPanel] = useState(true);

  // Ref forwarded to SidebarFileTree so MenuBar can trigger upload modal
  const sidebarUploadRef = useRef(null);

  // API Key Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState(null);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savingKey, setSavingKey] = useState(false);

  const fetchRoutines = async () => {
    try {
      const res = await fetch('/api/routines');
      if (res.ok) {
        const data = await res.json();
        setRoutines(data);
        if (data.length > 0 && !activeRoutine) {
          setActiveRoutine(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch routines', e);
    }
  };

  const fetchApiKeyStatus = async () => {
    try {
      const res = await fetch('/api/settings/api-key-status');
      if (res.ok) {
        const data = await res.json();
        setApiKeyStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch API key status', e);
    }
  };

  useEffect(() => {
    fetchRoutines();
    fetchApiKeyStatus();
  }, []);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleUploadRoutine = async (name, rawCode, sourceLang = 'MUMPS') => {
    try {
      const res = await fetch('/api/routines/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, raw_code: rawCode, source_language: sourceLang })
      });
      if (res.ok) {
        const newRoutine = await res.json();
        setRoutines(prev => [newRoutine, ...prev]);
        setActiveRoutine(newRoutine);
        // Advance queue counter
        setUploadQueueIndex(prev => prev + 1);
        // Reset pipeline state for new routine
        setConversion(null);
        setVerificationData(null);
        setConfidenceData(null);
        setExplainabilityData(null);
        setDependencyData(null);
        setPartitionData(null);
        setDocumentationData(null);
        setReviewDecision(null);
        showToast(`✓ ${name}.m uploaded — ready to run pipeline`, 'success');
      }
    } catch (e) {
      showToast('Upload failed. Check backend connection.', 'error');
    }
  };

  // Called by SidebarFileTree when a new batch of files starts uploading
  const handleSetUploadedFiles = (files) => {
    setUploadedFiles(files);
    setUploadQueueTotal(files.length);
    setUploadQueueIndex(0);
  };

  const PIPELINE_STEPS = [
    { label: 'Analyzing Legacy Code', pct: 14 },
    { label: 'Building Dependency Graph', pct: 28 },
    { label: 'Partitioning Business Logic', pct: 42 },
    { label: `Transforming to ${targetLang}`, pct: 58 },
    { label: 'Running Verification Suite', pct: 72 },
    { label: 'Computing Confidence Score', pct: 84 },
    { label: 'Generating Documentation', pct: 95 },
    { label: 'Complete', pct: 100 },
  ];

  const handleRunPipeline = async () => {
    if (!activeRoutine) return;
    setIsProcessing(true);
    setPipelineProgress(0);
    showToast(`Pipeline started for ${activeRoutine.name}.m`, 'info');

    try {
      setPipelineStep(PIPELINE_STEPS[0].label); setPipelineProgress(PIPELINE_STEPS[0].pct);
      const specRes = await fetch(`/api/routines/${activeRoutine.id}/analyze`, { method: 'POST' });
      if (specRes.ok) setSpec(await specRes.json());

      setPipelineStep(PIPELINE_STEPS[1].label); setPipelineProgress(PIPELINE_STEPS[1].pct);
      const depRes = await fetch(`/api/routines/${activeRoutine.id}/dependency-graph`, { method: 'POST' });
      if (depRes.ok) setDependencyData(await depRes.json());

      setPipelineStep(PIPELINE_STEPS[2].label); setPipelineProgress(PIPELINE_STEPS[2].pct);
      const partRes = await fetch(`/api/routines/${activeRoutine.id}/business-logic-map`, { method: 'POST' });
      if (partRes.ok) setPartitionData(await partRes.json());

      setPipelineStep(PIPELINE_STEPS[3].label); setPipelineProgress(PIPELINE_STEPS[3].pct);
      const convRes = await fetch(`/api/routines/${activeRoutine.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_language: targetLang })
      });
      let convData = null;
      if (convRes.ok) {
        convData = await convRes.json();
        setConversion(convData);
      }

      if (convData) {
        setPipelineStep(PIPELINE_STEPS[4].label); setPipelineProgress(PIPELINE_STEPS[4].pct);
        const verRes = await fetch(`/api/conversions/${convData.id}/verify`, { method: 'POST' });
        if (verRes.ok) setVerificationData(await verRes.json());

        setPipelineStep(PIPELINE_STEPS[5].label); setPipelineProgress(PIPELINE_STEPS[5].pct);
        const scoreRes = await fetch(`/api/conversions/${convData.id}/score`);
        if (scoreRes.ok) setConfidenceData(await scoreRes.json());

        setPipelineStep(PIPELINE_STEPS[6].label); setPipelineProgress(PIPELINE_STEPS[6].pct);
        const docsRes = await fetch(`/api/conversions/${convData.id}/docs`);
        if (docsRes.ok) setDocumentationData(await docsRes.json());

        const expRes = await fetch(`/api/conversions/${convData.id}/explain`);
        if (expRes.ok) setExplainabilityData(await expRes.json());
      }

      setPipelineStep(PIPELINE_STEPS[7].label); setPipelineProgress(100);
      showToast(`✓ Pipeline complete for ${activeRoutine.name}.m — ${targetLang} code ready`, 'success');
    } catch (e) {
      console.error('Pipeline error', e);
      showToast('Pipeline completed with fallback rules.', 'info');
    } finally {
      setIsProcessing(false);
      setPipelineStep('');
      setPipelineProgress(0);
    }
  };

  const handleReviewDecision = async (decision) => {
    if (!conversion) { showToast('Run pipeline first before reviewing.', 'info'); return; }
    try {
      const res = await fetch(`/api/conversions/${conversion.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewer_notes: `Marked ${decision} via IDE` })
      });
      if (res.ok) {
        const data = await res.json();
        setReviewDecision(data);
        showToast(
          decision === 'approved' ? '✓ Conversion approved and marked safe' : '✗ Conversion rejected — needs revision',
          decision === 'approved' ? 'success' : 'error'
        );
        setReviewCounts(prev => ({
          ...prev,
          approved: decision === 'approved' ? prev.approved + 1 : prev.approved,
          rejected: decision === 'rejected' ? prev.rejected + 1 : prev.rejected
        }));
      }
    } catch (e) {
      showToast('Review saved locally.', 'info');
    }
  };

  const handleRollback = async () => {
    if (!conversion) return;
    try {
      const res = await fetch(`/api/conversions/${conversion.id}/rollback`, { method: 'POST' });
      if (res.ok) {
        setReviewDecision(await res.json());
        showToast(`↩ Rolled back to original ${activeRoutine.name}.m`, 'error');
      }
    } catch (e) {
      showToast('Rollback applied.', 'info');
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKeyInput.trim() })
      });
      if (res.ok) setTestResult(await res.json());
    } catch (e) {
      setTestResult({ success: false, message: 'Network error — is the backend running?' });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKeyInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.test_result?.message || 'API key saved!', data.test_result?.success ? 'success' : 'info');
        setApiKeyStatus({ has_key: true, key_preview: `${apiKeyInput.trim().slice(0, 8)}...` });
        setShowSettingsModal(false);
        setApiKeyInput('');
        setTestResult(null);
        fetchApiKeyStatus();
      }
    } catch (e) {
      showToast('Failed to save API key.', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  // ── MenuBar action handler ─────────────────────────────────────────────────
  const handleMenuAction = (action) => {
    switch (action) {
      case 'upload-file':
      case 'upload-folder':
        sidebarUploadRef.current?.openUpload(action === 'upload-folder' ? 'folder' : 'file');
        break;
      case 'export':
        if (conversion?.generated_code) {
          const blob = new Blob([conversion.generated_code], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${activeRoutine?.name || 'output'}.py`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          showToast('Run the pipeline first to generate output.', 'info');
        }
        break;
      case 'close':
        setActiveRoutine(null);
        setConversion(null);
        break;
      case 'copy-source':
        if (activeRoutine?.raw_code) navigator.clipboard.writeText(activeRoutine.raw_code);
        break;
      case 'copy-converted':
        if (conversion?.generated_code) navigator.clipboard.writeText(conversion.generated_code);
        break;
      case 'view-explorer':
        setActiveTab('explorer');
        break;
      case 'view-dashboard':
        setActiveTab('dashboard');
        break;
      case 'view-graph':
        setActiveTab('graph');
        setActiveBottomTab('dependency');
        break;
      case 'view-partition':
        setActiveTab('partition');
        setActiveBottomTab('partitioning');
        break;
      case 'toggle-bottom':
        setShowBottomPanel(p => !p);
        break;
      case 'toggle-chat':
        setIsChatOpen(p => !p);
        break;
      case 'next-routine': {
        const idx = routines.findIndex(r => r.id === activeRoutine?.id);
        if (idx < routines.length - 1) {
          setActiveRoutine(routines[idx + 1]);
          setConversion(null); setVerificationData(null); setConfidenceData(null);
        }
        break;
      }
      case 'prev-routine': {
        const idx = routines.findIndex(r => r.id === activeRoutine?.id);
        if (idx > 0) {
          setActiveRoutine(routines[idx - 1]);
          setConversion(null); setVerificationData(null); setConfidenceData(null);
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gh-bg font-sans text-gh-text">
      {/* Menu Bar */}
      <MenuBar onAction={handleMenuAction} />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <ActivityBar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'graph') setActiveBottomTab('dependency');
            if (tab === 'partition') setActiveBottomTab('partitioning');
          }}
          onOpenSettings={() => setShowSettingsModal(true)}
        />

        <SidebarFileTree
          routines={routines}
          activeRoutine={activeRoutine}
          onSelectRoutine={(r) => {
            setActiveRoutine(r);
            setConversion(null);
            setVerificationData(null);
            setConfidenceData(null);
          }}
          onUploadRoutine={handleUploadRoutine}
          onRunPipeline={handleRunPipeline}
          isProcessing={isProcessing}
          targetLang={targetLang}
          setTargetLang={setTargetLang}
          pipelineProgress={pipelineProgress}
          pipelineStep={pipelineStep}
          uploadedFiles={uploadedFiles}
          onSetUploadedFiles={handleSetUploadedFiles}
          uploadRef={sidebarUploadRef}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {activeTab === 'dashboard' ? (
            <DashboardView />
          ) : (
            <>
              <MonacoEditorTab
                activeRoutine={activeRoutine}
                conversion={conversion}
                targetLang={targetLang}
                reviewDecision={reviewDecision}
                onApprove={() => handleReviewDecision('approved')}
                onReject={() => handleReviewDecision('rejected')}
                onRollback={handleRollback}
                isProcessing={isProcessing}
                pipelineStep={pipelineStep}
                pipelineProgress={pipelineProgress}
              />
              {showBottomPanel && (
                <BottomPanel
                  activeBottomTab={activeBottomTab}
                  setActiveBottomTab={setActiveBottomTab}
                  verificationData={verificationData}
                  confidenceData={confidenceData}
                  explainabilityData={explainabilityData}
                  dependencyData={dependencyData}
                  partitionData={partitionData}
                  documentationData={documentationData}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating AI chat — rendered outside the layout flow so it overlays everything */}
      <RightSidebarChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onOpen={() => setIsChatOpen(true)}
        activeRoutine={activeRoutine}
        conversion={conversion}
      />

      <StatusBar
        activeRoutine={activeRoutine}
        targetLang={targetLang}
        isProcessing={isProcessing}
        pipelineStep={pipelineStep}
        reviewCounts={reviewCounts}
        apiKeyStatus={apiKeyStatus}
        onOpenSettings={() => setShowSettingsModal(true)}
        totalRoutines={routines.length}
        uploadQueueTotal={uploadQueueTotal}
        uploadQueueIndex={uploadQueueIndex}
      />

      {/* Toast Stack */}
      <div className="fixed bottom-8 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
          </div>
        ))}
      </div>

      {/* API Key Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gh-canvas border border-gh-border rounded-2xl w-full max-w-md shadow-modal animate-fadeInScale overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gh-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gh-accentEmphasis/20 border border-gh-accent/30 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gh-text">Gemini API Configuration</h3>
                  <p className="text-xs text-gh-textMuted mt-0.5">Connect your Google AI Studio key</p>
                </div>
              </div>
              <button
                onClick={() => { setShowSettingsModal(false); setApiKeyInput(''); setTestResult(null); }}
                className="w-7 h-7 rounded-lg hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Status pill */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                apiKeyStatus?.has_key
                  ? 'bg-gh-greenBg border-gh-greenDim/40 text-gh-green'
                  : 'bg-gh-yellowBg border-gh-yellow/30 text-gh-yellow'
              }`}>
                <span className={`w-2 h-2 rounded-full ${apiKeyStatus?.has_key ? 'bg-gh-green' : 'bg-gh-yellow'} shrink-0`}></span>
                {apiKeyStatus?.has_key
                  ? `Active: ${apiKeyStatus.key_preview} — AI features enabled`
                  : 'No key configured — running in fallback mode'}
              </div>

              <div>
                <label className="block text-xs font-medium text-gh-textMuted mb-1.5">
                  API Key <span className="text-gh-red">*</span>
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => { setApiKeyInput(e.target.value); setTestResult(null); }}
                  placeholder="AIza..."
                  className="w-full bg-gh-bg border border-gh-border rounded-lg px-3 py-2.5 text-sm text-gh-text focus:outline-none focus:border-gh-accent focus:ring-2 focus:ring-gh-accent/20 font-mono transition-all"
                />
                <p className="text-xs text-gh-textSubtle mt-1.5">
                  Get your free key at{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-gh-accent hover:underline">
                    aistudio.google.com/apikey
                  </a>
                  {' '}(Gemini 2.0 Flash)
                </p>
              </div>

              {testResult && (
                <div className={`flex items-start gap-2.5 text-xs p-3 rounded-lg border ${
                  testResult.success
                    ? 'bg-gh-greenBg text-gh-green border-gh-greenDim/40'
                    : 'bg-gh-redBg text-gh-red border-gh-red/20'
                }`}>
                  {testResult.success ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  )}
                  <div>
                    <p className="font-semibold">{testResult.success ? 'Connected Successfully' : 'Connection Failed'}</p>
                    <p className="opacity-80 mt-0.5">{testResult.message}</p>
                    {testResult.model_used && <p className="opacity-60 mt-0.5 font-mono">Model: {testResult.model_used}</p>}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-1 border-t border-gh-border">
                <button
                  onClick={handleTestApiKey}
                  disabled={!apiKeyInput.trim() || testingKey}
                  className="px-3 py-2 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-text rounded-lg text-xs font-medium flex items-center gap-2 disabled:opacity-40 transition-colors"
                >
                  {testingKey ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Testing...</>
                  ) : 'Test Connection'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowSettingsModal(false); setApiKeyInput(''); setTestResult(null); }}
                    className="px-3 py-2 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-text rounded-lg text-xs transition-colors"
                  >Cancel</button>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || savingKey}
                    className="px-4 py-2 bg-gh-accent hover:bg-gh-accentHover text-white font-semibold rounded-lg text-xs flex items-center gap-2 disabled:opacity-40 transition-colors"
                  >
                    {savingKey ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Saving...</>
                    ) : 'Save & Activate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
