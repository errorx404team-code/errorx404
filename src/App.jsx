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
import DepReviewModal from './components/DepReviewModal';
import StartupLandingPage from './components/StartupLandingPage';

export default function App() {
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [routines, setRoutines] = useState([]);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [openRoutineIds, setOpenRoutineIds] = useState([]);

  const [targetLang, setTargetLang] = useState('Python');
  const [activeTab, setActiveTab] = useState('explorer');
  const [activeBottomTab, setActiveBottomTab] = useState('verification');
  const [isChatOpen, setIsChatOpen] = useState(true);

  const [uploadedFiles, setUploadedFiles] = useState([]);      // [{ file, rel }]
  const [uploadQueueTotal, setUploadQueueTotal] = useState(0); // total files in last batch
  const [uploadQueueIndex, setUploadQueueIndex] = useState(0); // how many have been uploaded so far
  const [isUploading, setIsUploading] = useState(false);

  // Workspace state — each upload creates an isolated workspace/tab
  const [workspaces, setWorkspaces] = useState([]);          // [{ id, name }]
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);

  // Per-routine pipeline cache map: { [routineId]: { spec, conversion, verificationData, ... } }
  const [pipelineCache, setPipelineCache] = useState({});

  // Pipeline Data States (derived from pipelineCache[activeRoutine?.id] or current run)
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

  // Review loading states — prevents duplicate requests and shows spinner in buttons
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Project Pipeline state variables
  const [projectPipelineStatus, setProjectPipelineStatus] = useState('idle'); // idle, running, completed, failed
  const [projectPipelineLog, setProjectPipelineLog] = useState([]);
  const [routineStatuses, setRoutineStatuses] = useState({}); // { [routineId]: 'pending' | 'analyzing' | 'completed' | 'failed' }

  // NEW: Workspace-level analysis state
  const [conversionPlan, setConversionPlan] = useState(null);
  const [projectVerification, setProjectVerification] = useState(null);
  const [workspaceCycles, setWorkspaceCycles] = useState([]);
  const [isVerifyingProject, setIsVerifyingProject] = useState(false);

  // Feature 2: Per-routine dependency analysis state
  // { [routineId]: { done: bool, analyzing: bool } }
  const [depAnalysisState, setDepAnalysisState] = useState({});

  // Dep Review Modal state
  const [depReviewOpen, setDepReviewOpen]       = useState(false);
  const [depReviewStage, setDepReviewStage]     = useState('analyze'); // 'analyze'|'deps'|'logic'|'review'
  const [depReviewData, setDepReviewData]       = useState(null);  // { nodes, edges }
  const [depReviewPartition, setDepReviewPartition] = useState(null);
  const [depReviewSpec, setDepReviewSpec]       = useState(null);
  const [depReviewAISummary, setDepReviewAISummary] = useState(null);
  const [depReviewAnalyzing, setDepReviewAnalyzing] = useState(false);
  // Pending single-routine pipeline data collected during analysis phase
  const depReviewPending = useRef(null); // { spec, depData, partData, routineId }

  // Batch (project-level) dep review state
  const [depReviewBatchMode, setDepReviewBatchMode]         = useState(false);
  const [depReviewFileStatuses, setDepReviewFileStatuses]   = useState({}); // { [routineId]: status }
  const [depReviewFileDepData, setDepReviewFileDepData]     = useState({}); // { [routineId]: depData }
  const [depReviewWorkspaceGraph, setDepReviewWorkspaceGraph] = useState(null); // merged workspace graph
  const batchAnalysisCache = useRef({}); // { [routineId]: { spec, depData, partData } }

  // Ref forwarded to SidebarFileTree so MenuBar and WelcomeScreen can trigger upload modal
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

        // Derive workspaces from the routines' workspace_id values
        const wsMap = new Map();
        for (const r of data) {
          const wid = r.workspace_id || '__default__';
          if (!wsMap.has(wid)) {
            // Derive a display name from relative_path or routine name
            const rel = r.relative_path || '';
            const topFolder = rel.includes('/') ? rel.split('/')[0] : null;
            wsMap.set(wid, { id: wid, name: topFolder || r.name });
          }
        }
        const wsList = Array.from(wsMap.values());
        setWorkspaces(wsList);

        // If no active workspace yet but there are workspaces, select the first
        if (wsList.length > 0 && !activeWorkspaceId) {
          setActiveWorkspaceId(wsList[0].id);
        }

        if (data.length > 0 && !activeRoutine && openRoutineIds.length === 0) {
          // Auto-select first routine in active workspace
          const activeWs = activeWorkspaceId || (wsList.length > 0 ? wsList[0].id : null);
          const wsRoutines = activeWs ? data.filter(r => (r.workspace_id || '__default__') === activeWs) : data;
          if (wsRoutines.length > 0) {
            setActiveRoutine(wsRoutines[0]);
            setOpenRoutineIds([wsRoutines[0].id]);
          }
        }
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch routines', e);
    }
    return [];
  };

  // Derived: routines filtered to the active workspace
  const workspaceRoutines = activeWorkspaceId
    ? routines.filter(r => (r.workspace_id || '__default__') === activeWorkspaceId)
    : routines;


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

  // Sync active pipeline states whenever activeRoutine changes
  useEffect(() => {
    if (!activeRoutine) {
      setSpec(null);
      setConversion(null);
      setVerificationData(null);
      setConfidenceData(null);
      setExplainabilityData(null);
      setDependencyData(null);
      setPartitionData(null);
      setDocumentationData(null);
      setReviewDecision(null);
      return;
    }

    const cached = pipelineCache[activeRoutine.id] || {};
    setSpec(cached.spec || null);
    setConversion(cached.conversion || null);
    setVerificationData(cached.verificationData || null);
    setConfidenceData(cached.confidenceData || null);
    setExplainabilityData(cached.explainabilityData || null);
    setDependencyData(cached.dependencyData || null);
    setPartitionData(cached.partitionData || null);
    setDocumentationData(cached.documentationData || null);
    setReviewDecision(cached.reviewDecision || null);
  }, [activeRoutine, pipelineCache]);

  // Synchronize editor tabs and active routine when changing workspaces
  useEffect(() => {
    if (!activeWorkspaceId) return;

    // Filter open tabs to only contain routines in the active workspace
    setOpenRoutineIds(prev => {
      const filtered = prev.filter(id => {
        const r = routines.find(x => x.id === id);
        return r && (r.workspace_id || '__default__') === activeWorkspaceId;
      });
      return filtered;
    });

    // If active routine is not in the active workspace, switch to the first routine of the new workspace
    if (activeRoutine && (activeRoutine.workspace_id || '__default__') !== activeWorkspaceId) {
      const wsRoutines = routines.filter(r => (r.workspace_id || '__default__') === activeWorkspaceId);
      if (wsRoutines.length > 0) {
        setActiveRoutine(wsRoutines[0]);
        setOpenRoutineIds(prev => {
          const filtered = prev.filter(id => {
            const r = routines.find(x => x.id === id);
            return r && (r.workspace_id || '__default__') === activeWorkspaceId;
          });
          return filtered.includes(wsRoutines[0].id) ? filtered : [...filtered, wsRoutines[0].id];
        });
      } else {
        setActiveRoutine(null);
      }
    }
  }, [activeWorkspaceId, routines]);

  // Automate review counts synchronization
  useEffect(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    workspaceRoutines.forEach(r => {
      const cached = pipelineCache[r.id];
      if (cached?.conversion) {
        const dec = cached.reviewDecision?.decision;
        if (dec === 'approved') approved++;
        else if (dec === 'rejected') rejected++;
        else pending++;
      } else {
        pending++;
      }
    });
    setReviewCounts({ approved, pending, rejected });
  }, [workspaceRoutines, pipelineCache]);

  const getProjectDependencyData = () => {
    const mergedNodesMap = new Map();
    const mergedEdgesMap = new Map();
    workspaceRoutines.forEach(r => {
      const cached = pipelineCache[r.id];
      if (cached?.dependencyData) {
        const { nodes = [], edges = [] } = cached.dependencyData;
        nodes.forEach(n => mergedNodesMap.set(n.id, n));
        edges.forEach(e => {
          const edgeKey = `${e.source}-${e.target}-${e.relationship}`;
          mergedEdgesMap.set(edgeKey, e);
        });
      }
    });
    return {
      nodes: Array.from(mergedNodesMap.values()),
      edges: Array.from(mergedEdgesMap.values())
    };
  };

  const getProjectPartitionData = () => {
    const mergedPartitions = [];
    let totalCohesion = 0;
    let count = 0;
    workspaceRoutines.forEach(r => {
      const cached = pipelineCache[r.id];
      if (cached?.partitionData) {
        const { partitions = [], overall_cohesion = 0 } = cached.partitionData;
        partitions.forEach(p => {
          mergedPartitions.push({
            ...p,
            partition_name: `${r.name}: ${p.partition_name}`
          });
        });
        totalCohesion += overall_cohesion;
        count++;
      }
    });
    return {
      partitions: mergedPartitions,
      overall_cohesion: count > 0 ? parseFloat((totalCohesion / count).toFixed(1)) : 0
    };
  };

  const projectDependencyData = getProjectDependencyData();
  const projectPartitionData = getProjectPartitionData();

  // ── Dep Review helpers ────────────────────────────────────────────────────

  /**
   * Run analysis phase (Analyze + Dependency Graph + Business Logic Map) for a
   * single routine and open the fullscreen Dep Review Modal.
   * Conversion does NOT start here.
   */
  const runAnalysisPhase = async (routine) => {
    if (!routine) return;
    setDepReviewOpen(true);
    setDepReviewAnalyzing(true);
    setDepReviewData(null);
    setDepReviewPartition(null);
    setDepReviewSpec(null);
    setDepReviewAISummary(null);
    setDepReviewStage('analyze');
    depReviewPending.current = null;

    let spec    = null;
    let depData = null;
    let partData= null;

    try {
      // Step 1 — Analyze
      setDepReviewStage('analyze');
      const specRes = await fetch(`/api/routines/${routine.id}/analyze`, { method: 'POST' });
      if (specRes.ok) spec = await specRes.json();

      // Step 2 — Dependency graph
      setDepReviewStage('deps');
      const depRes = await fetch(`/api/routines/${routine.id}/dependency-graph`, { method: 'POST' });
      if (depRes.ok) {
        depData = await depRes.json();
        setDepReviewData(depData);
        setDepAnalysisState(prev => ({ ...prev, [routine.id]: { done: true, analyzing: false } }));
        // Cache into pipeline cache immediately so bottom panel has it
        setPipelineCache(prev => ({
          ...prev,
          [routine.id]: { ...(prev[routine.id] || {}), spec, dependencyData: depData }
        }));
      }

      // Step 3 — Business logic map
      setDepReviewStage('logic');
      const partRes = await fetch(`/api/routines/${routine.id}/business-logic-map`, { method: 'POST' });
      if (partRes.ok) {
        partData = await partRes.json();
        setDepReviewPartition(partData);
      }

      // Step 4 — Generate a concise AI plain-English summary of the dep graph
      setDepReviewStage('review');
      if (depData) {
        try {
          const summaryRes = await fetch('/api/dep-graph/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              routine_ids: [routine.id],
              nodes: depData.nodes || [],
              edges: depData.edges || [],
            }),
          });
          if (summaryRes.ok) {
            const explainData = await summaryRes.json();
            // Build a plain-text summary from the structured response
            const parts = [];
            if (explainData.summary) parts.push(explainData.summary);
            if (explainData.relationships?.length) {
              parts.push('Key connections: ' + explainData.relationships.slice(0,3).join('. '));
            }
            if (explainData.warnings?.length) {
              parts.push('Warnings: ' + explainData.warnings.join('. '));
            }
            setDepReviewAISummary(parts.join('\n\n') || null);
          }
        } catch (_) { /* non-fatal */ }
      }

      // Store pending data so "Confirm" can pick it up
      depReviewPending.current = { spec, depData, partData, routineId: routine.id };

    } catch (e) {
      showToast(`Analysis error: ${e.message}`, 'error');
    } finally {
      setDepReviewAnalyzing(false);
    }
  };

  /**
   * Called when user clicks "Confirm & Convert to Python" inside DepReviewModal.
   * Runs conversion + verification + scoring + docs + explainability.
   *
   * STRICT RULE: If the backend returns HTTP 503 (AI_CONVERSION_FAILED), the
   * conversion STOPS and the user is shown a clear error. No fake success.
   */
  const handleConfirmAndConvert = async () => {
    if (!activeRoutine) return;
    setDepReviewOpen(false);
    setIsProcessing(true);
    setPipelineProgress(0);

    const pending = depReviewPending.current || {};
    const routineId = pending.routineId || activeRoutine.id;

    let currentSpec     = pending.spec     || null;
    let currentDep      = pending.depData  || null;
    let currentPart     = pending.partData || null;
    let currentConv     = null;
    let currentVer      = null;
    let currentScore    = null;
    let currentDocs     = null;
    let currentExp      = null;

    showToast(`Converting ${activeRoutine.name}.m to ${targetLang}…`, 'info');

    try {
      // Convert
      setPipelineStep(`Transforming to ${targetLang}`); setPipelineProgress(30);
      const convRes = await fetch(`/api/routines/${routineId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_language: targetLang }),
      });

      if (!convRes.ok) {
        // Handle AI conversion failure — do NOT silently continue with fake code
        let errDetail = `HTTP ${convRes.status}`;
        try {
          const errJson = await convRes.json();
          if (errJson.detail?.error === 'AI_CONVERSION_FAILED') {
            errDetail = errJson.detail.message || 'AI conversion failed.';
          } else if (errJson.detail) {
            errDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch (_) {}
        showToast(`✗ AI Conversion Failed: ${errDetail}`, 'error');
        setIsProcessing(false);
        setPipelineStep('');
        setPipelineProgress(0);
        return; // STOP — no fake conversion
      }

      currentConv = await convRes.json();

      if (currentConv) {
        // Verify
        setPipelineStep('Running Verification Suite'); setPipelineProgress(50);
        const verRes = await fetch(`/api/conversions/${currentConv.id}/verify`, { method: 'POST' });
        if (verRes.ok) currentVer = await verRes.json();

        // Score
        setPipelineStep('Computing Confidence Score'); setPipelineProgress(65);
        const scoreRes = await fetch(`/api/conversions/${currentConv.id}/score`);
        if (scoreRes.ok) currentScore = await scoreRes.json();

        // Docs
        setPipelineStep('Generating Documentation'); setPipelineProgress(80);
        const docsRes = await fetch(`/api/conversions/${currentConv.id}/docs`);
        if (docsRes.ok) currentDocs = await docsRes.json();

        // Explainability
        setPipelineStep('Building Explainability Trace'); setPipelineProgress(90);
        const expRes = await fetch(`/api/conversions/${currentConv.id}/explain`);
        if (expRes.ok) currentExp = await expRes.json();
      }

      setPipelineStep('Complete'); setPipelineProgress(100);

      // Update pipeline cache
      setPipelineCache(prev => ({
        ...prev,
        [routineId]: {
          spec:             currentSpec,
          conversion:       currentConv,
          verificationData: currentVer,
          confidenceData:   currentScore,
          explainabilityData: currentExp,
          dependencyData:   currentDep,
          partitionData:    currentPart,
          documentationData: currentDocs,
          reviewDecision:   null,
        }
      }));

      // Show appropriate success message based on conversion source
      const convSrc = currentConv?.conversion_source;
      if (convSrc === 'REAL_GEMINI') {
        showToast(`✓ Real AI Conversion complete for ${activeRoutine.name}.m`, 'success');
      } else if (convSrc === 'DEMO_FALLBACK') {
        showToast(`⚠ Demo conversion for ${activeRoutine.name}.m — configure Gemini API key for real AI conversion`, 'info');
      } else {
        showToast(`✓ Conversion complete for ${activeRoutine.name}.m`, 'success');
      }
    } catch (e) {
      console.error('Conversion error', e);
      showToast(`✗ Conversion failed: ${e.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setPipelineStep('');
      setPipelineProgress(0);
    }
  };

  // Feature 2: standalone dep analysis (for bottom panel graph tab)
  const handleRunDependencyAnalysis = async (routineId) => {
    if (!routineId) return;
    setDepAnalysisState(prev => ({ ...prev, [routineId]: { done: false, analyzing: true } }));
    setActiveBottomTab('dependency');
    setShowBottomPanel(true);
    try {
      const res = await fetch(`/api/routines/${routineId}/dependency-graph`, { method: 'POST' });
      if (res.ok) {
        const depData = await res.json();
        setPipelineCache(prev => ({
          ...prev,
          [routineId]: { ...(prev[routineId] || {}), dependencyData: depData }
        }));
        setDepAnalysisState(prev => ({ ...prev, [routineId]: { done: true, analyzing: false } }));
        showToast('✓ Dependency graph ready', 'success');
      } else {
        setDepAnalysisState(prev => ({ ...prev, [routineId]: { done: false, analyzing: false } }));
      }
    } catch (e) {
      setDepAnalysisState(prev => ({ ...prev, [routineId]: { done: false, analyzing: false } }));
    }
  };

  // Kept for bottom panel "Proceed" button (if graph already done)
  const handleProceedToConversion = () => {
    if (!activeRoutine) return;
    handleConfirmAndConvert();
  };

  const handleSelectRoutine = (routine) => {
    if (!routine) return;
    setActiveRoutine(routine);
    setOpenRoutineIds(prev => prev.includes(routine.id) ? prev : [...prev, routine.id]);
  };

  const handleCloseTab = (routineId) => {
    setOpenRoutineIds(prev => {
      const next = prev.filter(id => id !== routineId);
      if (activeRoutine?.id === routineId) {
        if (next.length > 0) {
          const nextActive = routines.find(r => r.id === next[next.length - 1]);
          setActiveRoutine(nextActive || null);
        } else {
          setActiveRoutine(null);
        }
      }
      return next;
    });
  };

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleUploadRoutine = async (name, rawCode, sourceLang = 'MUMPS', relativePath = null, workspaceId = null) => {
    setIsUploading(true);
    setUploadQueueTotal(1);
    setUploadQueueIndex(0);
    try {
      // Generate a new workspace_id for this single-file upload (isolated workspace)
      const wsId = workspaceId || crypto.randomUUID();
      const res = await fetch('/api/routines/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, raw_code: rawCode, source_language: sourceLang, relative_path: relativePath, workspace_id: wsId })
      });
      if (!res.ok) {
        let errDetail = `Status ${res.status}`;
        try {
          const errJson = await res.json();
          errDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch (_) {
          const text = await res.text();
          if (text) errDetail = text;
        }
        throw new Error(errDetail);
      }
      const newRoutine = await res.json();
      setUploadQueueIndex(1);

      // Switch to the new workspace immediately
      setActiveWorkspaceId(newRoutine.workspace_id || wsId);

      const latestRoutines = await fetchRoutines();
      const match = (latestRoutines || []).find(r => r.id === newRoutine.id) || newRoutine;
      
      // Clear previous tabs and open only the new one
      setOpenRoutineIds([match.id]);
      setActiveRoutine(match);

      showToast(`✓ ${name}.m uploaded — ready to run pipeline`, 'success');
      return newRoutine;
    } catch (e) {
      showToast(`Upload failed: ${e.message}`, 'error');
      throw e;
    } finally {
      setIsUploading(false);
      setUploadQueueTotal(0);
      setUploadQueueIndex(0);
    }
  };

  const handleUploadFiles = async (fileRequests) => {
    if (!fileRequests || fileRequests.length === 0) return [];
    setIsUploading(true);
    setUploadQueueTotal(fileRequests.length);
    setUploadQueueIndex(0);
    try {
      // Generate a unique workspace_id for this entire batch
      const wsId = crypto.randomUUID();
      const taggedRequests = fileRequests.map(fr => ({ ...fr, workspace_id: wsId }));

      const res = await fetch('/api/routines/upload-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taggedRequests)
      });
      if (!res.ok) {
        let errDetail = `Status ${res.status}`;
        try {
          const errJson = await res.json();
          errDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch (_) {
          const text = await res.text();
          if (text) errDetail = text;
        }
        throw new Error(errDetail);
      }
      const createdRoutines = await res.json();
      setUploadQueueIndex(fileRequests.length);

      // Switch to the newly created workspace
      const newWsId = (createdRoutines[0] && createdRoutines[0].workspace_id) || wsId;
      setActiveWorkspaceId(newWsId);

      const latestRoutines = await fetchRoutines();
      if (createdRoutines && createdRoutines.length > 0) {
        const lastCreated = createdRoutines[createdRoutines.length - 1];
        const match = (latestRoutines || []).find(r => r.id === lastCreated.id) || lastCreated;
        
        // Open only the newly uploaded files' tabs
        setOpenRoutineIds(createdRoutines.map(r => r.id));
        setActiveRoutine(match);

        showToast(`✓ ${createdRoutines.length} routine(s) uploaded — ready to run pipeline`, 'success');
      }
      return createdRoutines;
    } catch (e) {
      showToast(`Upload failed: ${e.message}`, 'error');
      throw e;
    } finally {
      setIsUploading(false);
      setUploadQueueTotal(0);
      setUploadQueueIndex(0);
    }
  };

  const handleSetUploadedFiles = (files) => {
    setUploadedFiles(files);
    setUploadQueueTotal(files.length);
    setUploadQueueIndex(0);
  };

  const handleExportProject = async () => {
    if (workspaceRoutines.length === 0) {
      showToast('No routines to export.', 'info');
      return;
    }
    showToast('Exporting project ZIP...', 'info');
    try {
      const res = await fetch('/api/projects/export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routine_ids: workspaceRoutines.map(r => r.id),
          include_sources: true
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ErrorX404-ConvertedProject.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('✓ Project ZIP exported successfully.', 'success');
      } else {
        showToast('Failed to export project ZIP.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Export failed.', 'error');
    }
  };

  // NEW: Workspace-level analysis + conversion plan fetch
  const handleAnalyzeWorkspace = async (wsId) => {
    if (!wsId) return;
    try {
      const res = await fetch(`/api/workspaces/${wsId}/analyze`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setConversionPlan(data.conversion_plan || null);
        setWorkspaceCycles(data.cycles || []);
        if (data.cycles?.length > 0) {
          showToast(`⚠ ${data.cycles.length} circular dependency detected`, 'info');
        }
        return data;
      }
    } catch (e) {
      console.warn('Workspace analysis failed (non-fatal):', e.message);
    }
    return null;
  };

  // NEW: Project-level verification
  const handleVerifyProject = async () => {
    if (!activeWorkspaceId || workspaceRoutines.length === 0) {
      showToast('Run pipeline first before verifying project.', 'info');
      return;
    }
    setIsVerifyingProject(true);
    setActiveBottomTab('project-verify');
    setShowBottomPanel(true);
    showToast('Running project-level integration verification...', 'info');
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/verify-project`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setProjectVerification(data);
        const status = data.overall_status;
        showToast(
          status === 'PASSED' ? '✓ Project verification passed!' :
          status === 'FAILED' ? '✗ Project verification failed — review issues.' :
          `Project verification: ${status}`,
          status === 'PASSED' ? 'success' : status === 'FAILED' ? 'error' : 'info'
        );
      }
    } catch (e) {
      showToast('Project verification failed.', 'error');
    } finally {
      setIsVerifyingProject(false);
    }
  };

  // NEW: Accept & Download (bulk approve + export zip)
  const handleAcceptAndDownload = async () => {
    if (workspaceRoutines.length === 0) {
      showToast('No routines to accept.', 'info');
      return;
    }
    showToast('Accepting project and generating download...', 'info');
    try {
      // 1. Bulk accept all conversions
      const acceptRes = await fetch('/api/projects/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          routine_ids: workspaceRoutines.map(r => r.id),
          decision: 'approved',
          reviewer_notes: 'Accepted via Accept & Download flow',
        })
      });
      if (!acceptRes.ok) {
        showToast('Acceptance failed. Check pipeline status.', 'error');
        return;
      }
      // Update local review decisions
      const acceptData = await acceptRes.json();
      if (acceptData.decisions) {
        const newCache = { ...pipelineCache };
        acceptData.decisions.forEach(d => {
          const rid = d.routine_id;
          if (newCache[rid]) {
            newCache[rid].reviewDecision = { decision: 'approved', reviewer_notes: 'Accepted via Accept & Download' };
          }
        });
        setPipelineCache(newCache);
      }

      // 2. Export ZIP
      await handleExportProject();
    } catch (e) {
      showToast('Accept & Download failed.', 'error');
    }
  };

  /**
   * Phase 1 of the multi-file pipeline: analyze ALL files (steps 1–3 each),
   * collect per-file dep graphs, fetch the merged workspace graph, then open
   * DepReviewModal in batch mode. Conversion only happens after the user confirms.
   */
  const handleRunProjectPipeline = async () => {
    if (workspaceRoutines.length === 0) return;

    // Reset batch state
    batchAnalysisCache.current = {};
    const initStatuses = {};
    workspaceRoutines.forEach(r => { initStatuses[r.id] = 'pending'; });
    setDepReviewFileStatuses(initStatuses);
    setDepReviewFileDepData({});
    setDepReviewWorkspaceGraph(null);
    setDepReviewAISummary(null);
    setDepReviewBatchMode(true);
    setDepReviewAnalyzing(true);
    setDepReviewStage('analyze');
    setDepReviewOpen(true);

    // Also update the bottom-panel pipeline log
    setProjectPipelineStatus('running');
    setProjectPipelineLog([]);
    setActiveBottomTab('pipeline-output');
    setShowBottomPanel(true);

    const initialStatuses = {};
    workspaceRoutines.forEach(r => { initialStatuses[r.id] = 'pending'; });
    setRoutineStatuses(initialStatuses);

    const log = (msg) => setProjectPipelineLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    log(`[INFO] Analysis phase: ${workspaceRoutines.length} files`);

    const totalSteps = workspaceRoutines.length * 3; // steps 1–3 only
    let completedSteps = 0;

    for (let index = 0; index < workspaceRoutines.length; index++) {
      const r = workspaceRoutines[index];
      log(`[PROCESS] Analyzing ${r.name}.m`);

      let currentSpec = null;
      let currentDep  = null;
      let currentPart = null;

      try {
        // Step 1: Analyze
        setDepReviewStage('analyze');
        setDepReviewFileStatuses(prev => ({ ...prev, [r.id]: 'analyzing' }));
        setRoutineStatuses(prev => ({ ...prev, [r.id]: 'analyzing' }));
        const specRes = await fetch(`/api/routines/${r.id}/analyze`, { method: 'POST' });
        if (specRes.ok) {
          currentSpec = await specRes.json();
          log(`  [✓] Spec for ${r.name}.m`);
        } else {
          throw new Error('Analysis failed');
        }
        completedSteps++;
        setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

        // Step 2: Dependency graph
        setDepReviewStage('deps');
        const depRes = await fetch(`/api/routines/${r.id}/dependency-graph`, { method: 'POST' });
        if (depRes.ok) {
          currentDep = await depRes.json();
          setDepAnalysisState(prev => ({ ...prev, [r.id]: { done: true, analyzing: false } }));
          setDepReviewFileDepData(prev => ({ ...prev, [r.id]: currentDep }));
          log(`  [✓] Dep graph for ${r.name}.m`);
        }
        completedSteps++;
        setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

        // Step 3: Business logic map
        setDepReviewStage('logic');
        const partRes = await fetch(`/api/routines/${r.id}/business-logic-map`, { method: 'POST' });
        if (partRes.ok) {
          currentPart = await partRes.json();
          log(`  [✓] Business map for ${r.name}.m`);
        }
        completedSteps++;
        setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

        // Cache results for conversion phase
        batchAnalysisCache.current[r.id] = { spec: currentSpec, depData: currentDep, partData: currentPart };
        setDepReviewFileStatuses(prev => ({ ...prev, [r.id]: 'completed' }));
        setRoutineStatuses(prev => ({ ...prev, [r.id]: 'analyzing' })); // stays 'analyzing' until conversion

        // Cache into pipelineCache for bottom panel
        setPipelineCache(prev => ({
          ...prev,
          [r.id]: { ...(prev[r.id] || {}), spec: currentSpec, dependencyData: currentDep, partitionData: currentPart }
        }));

        log(`[✓] Analysis complete for ${r.name}.m`);
      } catch (e) {
        log(`[ERROR] Analysis failed for ${r.name}.m: ${e.message}`);
        setDepReviewFileStatuses(prev => ({ ...prev, [r.id]: 'failed' }));
        setRoutineStatuses(prev => ({ ...prev, [r.id]: 'failed' }));
        completedSteps = (index + 1) * 3;
        setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));
      }
    }

    // Fetch merged workspace dep graph
    setDepReviewStage('review');
    if (activeWorkspaceId) {
      try {
        const wsGraphRes = await fetch(`/api/workspaces/${activeWorkspaceId}/graph`);
        if (wsGraphRes.ok) {
          const wsGraph = await wsGraphRes.json();
          setDepReviewWorkspaceGraph(wsGraph);
          setDepReviewData(wsGraph); // also set for single-file fallback display

          // Also run workspace analysis for conversion plan
          const analysisResult = await handleAnalyzeWorkspace(activeWorkspaceId);
          if (analysisResult?.conversion_plan) {
            setConversionPlan(analysisResult.conversion_plan);
            setWorkspaceCycles(analysisResult.cycles || []);
            if (analysisResult.cycles?.length > 0) {
              log(`[WARN] Circular deps: ${analysisResult.cycles.map(c=>c.join('→')).join(', ')}`);
            }
          }

          // Generate AI summary from the merged workspace graph
          try {
            const allRoutineIds = workspaceRoutines.map(r => r.id);
            const summaryRes = await fetch('/api/dep-graph/explain', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                routine_ids: allRoutineIds,
                nodes: wsGraph.nodes || [],
                edges: wsGraph.edges || [],
              }),
            });
            if (summaryRes.ok) {
              const explainData = await summaryRes.json();
              const parts = [];
              if (explainData.summary) parts.push(explainData.summary);
              if (explainData.relationships?.length) {
                parts.push('Key connections: ' + explainData.relationships.slice(0,3).join('. '));
              }
              if (explainData.warnings?.length) {
                parts.push('Warnings: ' + explainData.warnings.join('. '));
              }
              setDepReviewAISummary(parts.join('\n\n') || null);
            }
          } catch (_) { /* non-fatal */ }
        }
      } catch (_) { /* non-fatal */ }
    }

    setDepReviewAnalyzing(false);
    setPipelineProgress(0);
    setPipelineStep('');
    log(`[INFO] Analysis phase complete — review the dependency graph and confirm to convert`);
  };

  /**
   * Retry analysis for a single file that failed in batch mode.
   */
  const handleRetryBatchFile = async (routineId) => {
    const r = workspaceRoutines.find(x => x.id === routineId);
    if (!r) return;

    setDepReviewFileStatuses(prev => ({ ...prev, [routineId]: 'analyzing' }));
    setDepReviewAnalyzing(true);

    try {
      const specRes = await fetch(`/api/routines/${routineId}/analyze`, { method: 'POST' });
      if (!specRes.ok) throw new Error('Analysis failed');
      const currentSpec = await specRes.json();

      const depRes = await fetch(`/api/routines/${routineId}/dependency-graph`, { method: 'POST' });
      let currentDep = null;
      if (depRes.ok) {
        currentDep = await depRes.json();
        setDepAnalysisState(prev => ({ ...prev, [routineId]: { done: true, analyzing: false } }));
        setDepReviewFileDepData(prev => ({ ...prev, [routineId]: currentDep }));
      }

      const partRes = await fetch(`/api/routines/${routineId}/business-logic-map`, { method: 'POST' });
      let currentPart = null;
      if (partRes.ok) currentPart = await partRes.json();

      batchAnalysisCache.current[routineId] = { spec: currentSpec, depData: currentDep, partData: currentPart };
      setDepReviewFileStatuses(prev => ({ ...prev, [routineId]: 'completed' }));
      setPipelineCache(prev => ({
        ...prev,
        [routineId]: { ...(prev[routineId] || {}), spec: currentSpec, dependencyData: currentDep, partitionData: currentPart }
      }));
      showToast(`✓ Retry succeeded for ${r.name}.m`, 'success');
    } catch (e) {
      setDepReviewFileStatuses(prev => ({ ...prev, [routineId]: 'failed' }));
      showToast(`Retry failed for ${r.name}.m: ${e.message}`, 'error');
    } finally {
      setDepReviewAnalyzing(false);
    }
  };

  /**
   * Phase 2 (batch): runs after user clicks "Confirm & Convert" in batch DepReviewModal.
   * Converts + verifies + scores + docs + explains every successfully analyzed file.
   */
  const handleConfirmBatchConvert = async () => {
    setDepReviewOpen(false);
    setDepReviewBatchMode(false);
    setIsProcessing(true);
    setProjectPipelineStatus('running');

    const log = (msg) => setProjectPipelineLog(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    const filesToConvert = workspaceRoutines.filter(
      r => (depReviewFileStatuses[r.id] === 'completed' || batchAnalysisCache.current[r.id])
    );

    log(`[INFO] Conversion phase: ${filesToConvert.length} files`);

    const totalSteps = filesToConvert.length * 5; // steps 4–8
    let completedSteps = 0;
    const newCache = { ...pipelineCache };

    for (let index = 0; index < filesToConvert.length; index++) {
      const r = filesToConvert[index];
      const cached = batchAnalysisCache.current[r.id] || {};
      log(`[PROCESS] Converting ${r.name}.m`);

      let currentConv = null;
      let currentVer  = null;
      let currentScore= null;
      let currentDocs = null;
      let currentExp  = null;

      try {
        // Step 4: Convert
        setPipelineStep(`Converting ${r.name}.m`);
        setRoutineStatuses(prev => ({ ...prev, [r.id]: 'converting' }));
        const convRes = await fetch(`/api/routines/${r.id}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_language: targetLang }),
        });
        if (convRes.ok) {
          currentConv = await convRes.json();
          const convSrc = currentConv?.conversion_source;
          if (convSrc === 'REAL_GEMINI') {
            log(`  [✓] Real AI Conversion complete: ${r.name}.m`);
          } else if (convSrc === 'DEMO_FALLBACK') {
            log(`  [⚠] Demo fallback conversion for ${r.name}.m — configure Gemini API key for real AI conversion`);
          } else {
            log(`  [✓] Converted ${r.name}.m`);
          }
        } else {
          // Handle AI conversion failure — read error details
          let errMsg = 'Conversion failed';
          try {
            const errJson = await convRes.json();
            if (errJson.detail?.error === 'AI_CONVERSION_FAILED') {
              errMsg = `AI conversion failed (${errJson.detail.error_category || 'unknown'}): ${errJson.detail.message || ''}`;
            } else if (errJson.detail) {
              errMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
            }
          } catch (_) {}
          throw new Error(errMsg);
        }
        completedSteps++;
        setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

        if (currentConv) {
          // Step 5: Verify
          setPipelineStep(`Verifying ${r.name}.m`);
          const verRes = await fetch(`/api/conversions/${currentConv.id}/verify`, { method: 'POST' });
          if (verRes.ok) { currentVer = await verRes.json(); log(`  [✓] Verified`); }
          completedSteps++;
          setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

          // Step 6: Score
          setPipelineStep(`Scoring ${r.name}.m`);
          const scoreRes = await fetch(`/api/conversions/${currentConv.id}/score`);
          if (scoreRes.ok) {
            currentScore = await scoreRes.json();
            log(`  [✓] Score: ${currentScore.score}% (${currentScore.category})`);
          }
          completedSteps++;
          setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

          // Step 7: Docs
          setPipelineStep(`Documenting ${r.name}.m`);
          const docsRes = await fetch(`/api/conversions/${currentConv.id}/docs`);
          if (docsRes.ok) { currentDocs = await docsRes.json(); log(`  [✓] Docs generated`); }
          completedSteps++;
          setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));

          // Step 8: Explainability
          setPipelineStep(`Explaining ${r.name}.m`);
          const expRes = await fetch(`/api/conversions/${currentConv.id}/explain`);
          if (expRes.ok) { currentExp = await expRes.json(); log(`  [✓] Explainability trace`); }
          completedSteps++;
          setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));
        }

        newCache[r.id] = {
          spec:               cached.spec        || null,
          dependencyData:     cached.depData     || null,
          partitionData:      cached.partData    || null,
          conversion:         currentConv,
          verificationData:   currentVer,
          confidenceData:     currentScore,
          documentationData:  currentDocs,
          explainabilityData: currentExp,
          reviewDecision:     null,
        };
        setRoutineStatuses(prev => ({ ...prev, [r.id]: 'completed' }));
        log(`[SUCCESS] Done: ${r.name}.m`);
      } catch (e) {
        log(`[ERROR] ${r.name}.m: ${e.message}`);
        setRoutineStatuses(prev => ({ ...prev, [r.id]: 'failed' }));
        completedSteps = (index + 1) * 5;
        setPipelineProgress(Math.round((completedSteps / totalSteps) * 100));
      }
    }

    setPipelineCache(newCache);
    setProjectPipelineStatus('completed');
    setIsProcessing(false);
    setPipelineStep('');
    setPipelineProgress(0);
    log(`[INFO] Project pipeline complete!`);
    showToast('✓ Project pipeline completed successfully.', 'success');
  };

  /**
   * Single-routine "Run Pipeline" entry point.
   * Phase 1: Analyze → Dep Graph → Business Logic → show DepReviewModal
   * Phase 2 (after user confirmation): handleConfirmAndConvert()
   */
  const handleRunPipeline = async () => {
    if (!activeRoutine) return;
    showToast(`Analyzing ${activeRoutine.name}.m…`, 'info');
    await runAnalysisPhase(activeRoutine);
    // Phase 2 is triggered by the user clicking "Confirm & Convert" in the modal
  };

  // Legacy finalizer block kept so the finally block below compiles
  const _legacyFinallyPlaceholder = async () => {
    try { /* no-op */ }
    catch (e) { console.error('Pipeline error', e); }
    finally {
      setIsProcessing(false);
      setPipelineStep('');
      setPipelineProgress(0);
    }
  };

  // ── Accept: approve + download ZIP ────────────────────────────────────────
  const handleApprove = async () => {
    if (!conversion || isApproving || isRejecting) return;
    setIsApproving(true);
    try {
      // 1. Submit the review decision
      const reviewRes = await fetch(`/api/conversions/${conversion.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved', reviewer_notes: 'Accepted via IDE review terminal' })
      });
      if (!reviewRes.ok) {
        showToast('Failed to submit approval. Please try again.', 'error');
        return;
      }
      const reviewData = await reviewRes.json();

      // 2. Update local state
      setReviewDecision(reviewData);
      setPipelineCache(prev => ({
        ...prev,
        [activeRoutine.id]: { ...prev[activeRoutine.id], reviewDecision: reviewData }
      }));
      setReviewCounts(prev => ({ ...prev, approved: prev.approved + 1 }));

      // 3. Download the accepted conversion as ZIP
      showToast('Accepted! Preparing download…', 'info');
      try {
        const exportRes = await fetch('/api/projects/export-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routine_ids: workspaceRoutines.map(r => r.id),
            include_sources: true,
            workspace_id: activeWorkspaceId,
            only_accepted: false,  // include this newly accepted conversion
          })
        });
        if (exportRes.ok) {
          const blob = await exportRes.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ErrorX404-Accepted-${activeRoutine?.name || 'project'}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          showToast('Conversion accepted. Your converted Python project has been downloaded.', 'success');
        } else {
          showToast('Conversion accepted. ZIP export failed — use File → Export Project ZIP to retry.', 'info');
        }
      } catch (exportErr) {
        showToast('Conversion accepted. ZIP export failed — use File → Export Project ZIP to retry.', 'info');
      }
    } catch (e) {
      showToast('Approval failed. Please try again.', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // ── Reject: reject + invalidate generated code ─────────────────────────────
  const handleReject = async () => {
    if (!conversion || isApproving || isRejecting) return;
    setIsRejecting(true);
    try {
      // 1. Submit the review decision
      const reviewRes = await fetch(`/api/conversions/${conversion.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'rejected', reviewer_notes: 'Rejected via IDE review terminal' })
      });
      if (!reviewRes.ok) {
        showToast('Failed to submit rejection. Please try again.', 'error');
        return;
      }
      const reviewData = await reviewRes.json();

      // 2. Invalidate the generated code so it cannot be exported
      try {
        await fetch(`/api/conversions/${conversion.id}/invalidate`, { method: 'POST' });
      } catch (_) {
        // Non-fatal — review decision is already stored; the invalidation is best-effort
      }

      // 3. Update local state
      setReviewDecision(reviewData);
      // Clear the generated code from the local cache so the editor shows it as invalidated
      setPipelineCache(prev => ({
        ...prev,
        [activeRoutine.id]: {
          ...prev[activeRoutine.id],
          reviewDecision: reviewData,
          conversion: prev[activeRoutine.id]?.conversion
            ? {
                ...prev[activeRoutine.id].conversion,
                generated_code:
                  '# REJECTED CONVERSION — generated output removed.\n' +
                  '# The original MUMPS source code is preserved.\n',
              }
            : prev[activeRoutine.id]?.conversion,
        }
      }));
      setReviewCounts(prev => ({ ...prev, rejected: prev.rejected + 1 }));
      showToast('Conversion rejected. The generated Python output has been removed.', 'error');
    } catch (e) {
      showToast('Rejection failed. Please try again.', 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleRollback = async () => {
    if (!conversion) return;
    try {
      const res = await fetch(`/api/conversions/${conversion.id}/rollback`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setReviewDecision(data);
        setPipelineCache(prev => ({
          ...prev,
          [activeRoutine.id]: { ...prev[activeRoutine.id], reviewDecision: data }
        }));
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
      case 'export-project':
        handleExportProject();
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
        if (activeRoutine) handleCloseTab(activeRoutine.id);
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
      case 'view-human':
        setActiveBottomTab('human-understanding');
        setShowBottomPanel(true);
        break;
      case 'view-dep-graph':
        setActiveBottomTab('dependency');
        setShowBottomPanel(true);
        break;
      case 'toggle-bottom':
        setShowBottomPanel(p => !p);
        break;
      case 'toggle-chat':
        setIsChatOpen(p => !p);
        break;
      case 'next-routine': {
        const idx = workspaceRoutines.findIndex(r => r.id === activeRoutine?.id);
        if (idx !== -1 && idx < workspaceRoutines.length - 1) handleSelectRoutine(workspaceRoutines[idx + 1]);
        break;
      }
      case 'prev-routine': {
        const idx = workspaceRoutines.findIndex(r => r.id === activeRoutine?.id);
        if (idx !== -1 && idx > 0) handleSelectRoutine(workspaceRoutines[idx - 1]);
        break;
      }
      default:
        break;
    }
  };

  const openRoutines = workspaceRoutines.filter(r => openRoutineIds.includes(r.id));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gh-bg font-sans text-gh-text">
      {/* Menu Bar with Top-Right Run Pipeline Button & Language Dropdown */}
      <MenuBar
        onAction={handleMenuAction}
        activeRoutine={activeRoutine}
        targetLang={targetLang}
        setTargetLang={setTargetLang}
        isProcessing={isProcessing}
        pipelineStep={pipelineStep}
        pipelineProgress={pipelineProgress}
        onRunPipeline={handleRunProjectPipeline}
        totalRoutines={workspaceRoutines.length}
      />

      {/* Main VS Code Layout */}
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
          routines={workspaceRoutines}
          allRoutines={workspaceRoutines}
          activeRoutine={activeRoutine}
          onSelectRoutine={handleSelectRoutine}
          onUploadRoutine={handleUploadRoutine}
          onUploadFiles={handleUploadFiles}
          onRunPipeline={handleRunProjectPipeline}
          isProcessing={isProcessing}
          isUploading={isUploading}
          targetLang={targetLang}
          setTargetLang={setTargetLang}
          pipelineProgress={pipelineProgress}
          pipelineStep={pipelineStep}
          uploadedFiles={uploadedFiles}
          onSetUploadedFiles={handleSetUploadedFiles}
          uploadRef={sidebarUploadRef}
          pipelineCache={pipelineCache}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {activeTab === 'dashboard' ? (
            <DashboardView />
          ) : (
            <>
              <MonacoEditorTab
                openRoutines={openRoutines}
                activeRoutine={activeRoutine}
                onSelectRoutine={handleSelectRoutine}
                onCloseTab={handleCloseTab}
                onOpenUploadModal={(tab) => sidebarUploadRef.current?.openUpload(tab)}
                conversion={conversion}
                targetLang={targetLang}
                reviewDecision={reviewDecision}
                onApprove={handleApprove}
                onReject={handleReject}
                onRollback={handleRollback}
                isProcessing={isProcessing}
                pipelineStep={pipelineStep}
                pipelineProgress={pipelineProgress}
                onRunSinglePipeline={handleRunPipeline}
                isApproving={isApproving}
                isRejecting={isRejecting}
              />
              {showBottomPanel && (activeRoutine || projectPipelineStatus !== 'idle') && (
                <BottomPanel
                  activeBottomTab={activeBottomTab}
                  setActiveBottomTab={setActiveBottomTab}
                  verificationData={verificationData}
                  confidenceData={confidenceData}
                  explainabilityData={explainabilityData}
                  dependencyData={(activeTab === 'graph' || !activeRoutine) ? (projectDependencyData.nodes.length > 0 ? projectDependencyData : null) : dependencyData}
                  partitionData={(activeTab === 'partition' || !activeRoutine) ? (projectPartitionData.partitions.length > 0 ? projectPartitionData : null) : partitionData}
                  documentationData={documentationData}
                  projectPipelineLog={projectPipelineLog}
                  projectPipelineStatus={projectPipelineStatus}
                  routineStatuses={routineStatuses}
                  routines={workspaceRoutines}
                  conversionPlan={conversionPlan}
                  projectVerification={projectVerification}
                  workspaceCycles={workspaceCycles}
                  conversion={conversion}
                  activeRoutine={activeRoutine}
                  analysisComplete={activeRoutine ? (depAnalysisState[activeRoutine.id]?.done || !!dependencyData) : false}
                  isAnalyzing={activeRoutine ? (depAnalysisState[activeRoutine.id]?.analyzing || false) : false}
                  onRunAnalysis={() => activeRoutine && handleRunDependencyAnalysis(activeRoutine.id)}
                  onProceedToConversion={handleProceedToConversion}
                />
              )}

              {/* Verify Project + Accept & Download bar — shown after pipeline runs */}
              {projectPipelineStatus === 'completed' && workspaceRoutines.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 border-t border-gh-border bg-gh-canvas shrink-0">
                  <button
                    onClick={handleVerifyProject}
                    disabled={isVerifyingProject}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-textMuted hover:text-gh-text rounded-lg text-xs transition-colors disabled:opacity-40"
                  >
                    {isVerifyingProject ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                    )}
                    {isVerifyingProject ? 'Verifying…' : 'Verify Project'}
                  </button>
                  <button
                    onClick={handleAcceptAndDownload}
                    disabled={isProcessing}
                    title="Approve all conversions and download as ZIP"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gh-green/90 hover:bg-gh-green text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 shadow-sm"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 15V3m0 12l-4-4m4 4l4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/></svg>
                    Accept &amp; Download ZIP
                  </button>
                  <span className="text-[10px] text-gh-textSubtle italic ml-1">
                    ⚠ AI-generated code — review before accepting
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Dep Review Modal (fullscreen, z-50) ──────────────────────────── */}
      {depReviewOpen && (
        <DepReviewModal
          routineName={activeRoutine?.name || ''}
          depData={depReviewData}
          partitionData={depReviewPartition}
          specData={depReviewSpec}
          isAnalyzing={depReviewAnalyzing}
          analyzeStage={depReviewStage}
          aiSummary={depReviewAISummary}
          onBack={() => { setDepReviewOpen(false); setDepReviewBatchMode(false); }}
          onConfirmConvert={handleConfirmAndConvert}
          isBatchMode={depReviewBatchMode}
          workspaceRoutines={workspaceRoutines}
          fileStatuses={depReviewFileStatuses}
          fileDepData={depReviewFileDepData}
          workspaceDepData={depReviewWorkspaceGraph}
          onRetryFile={handleRetryBatchFile}
          onConfirmBatchConvert={handleConfirmBatchConvert}
        />
      )}

      {/* Floating AI Copilot Chat */}
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
        isUploading={isUploading}
        pipelineStep={pipelineStep}
        reviewCounts={reviewCounts}
        apiKeyStatus={apiKeyStatus}
        onOpenSettings={() => setShowSettingsModal(true)}
        totalRoutines={workspaceRoutines.length}
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

      {showLandingPage && (
        <StartupLandingPage onGoToWorkspace={() => setShowLandingPage(false)} />
      )}
    </div>
  );
}