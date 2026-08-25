import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  FileCode, Plus, Play, ChevronDown, ChevronRight,
  Upload, FolderOpen, Folder, ClipboardPaste, X, FileUp,
  AlertCircle, CheckCircle2,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRoutineName(filename) {
  return filename.replace(/\.(m|mps|txt|mumps|rou|cob|cbl)$/i, '');
}

function detectLanguage(filename) {
  return /\.(cob|cbl)$/i.test(filename) ? 'COBOL' : 'MUMPS';
}

/**
 * Build a nested folder tree from a flat list of File objects.
 * Each file may have webkitRelativePath, e.g. "routines/va/PSOHLDS.m"
 * Returns: { name, path, children: [...], files: [...] }
 */
function buildTree(files) {
  const root = { name: '', path: '', children: {}, files: [] };

  for (const file of files) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');

    if (parts.length === 1) {
      // top-level file — no folder
      root.files.push({ file, label: file.name, rel });
    } else {
      // navigate/create folder nodes
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (!node.children[seg]) {
          node.children[seg] = {
            name: seg,
            path: parts.slice(0, i + 1).join('/'),
            children: {},
            files: [],
          };
        }
        node = node.children[seg];
      }
      node.files.push({ file, label: parts[parts.length - 1], rel });
    }
  }
  return root;
}

<<<<<<< HEAD
/**
 * Build a nested folder tree from routines loaded from the backend.
 * Uses routine.relative_path (persisted in SQLite) to reconstruct hierarchy.
 * Returns the same shape as buildTree so FileTreeNode can render it.
 */
function buildTreeFromRoutines(routines, pipelineCache = {}) {
  const root = { name: '', path: '', children: {}, files: [] };

  for (const routine of routines) {
    const rel = routine.relative_path || `${routine.name}.m`;
    const parts = rel.split('/');
    const parentParts = parts.slice(0, -1);
    const filename = parts[parts.length - 1];

    let node = root;
    for (let i = 0; i < parentParts.length; i++) {
      const seg = parentParts[i];
      if (!node.children[seg]) {
        node.children[seg] = {
          name: seg,
          path: parentParts.slice(0, i + 1).join('/'),
          children: {},
          files: [],
        };
      }
      node = node.children[seg];
    }
    
    // Add original source file
    node.files.push({ routineRef: routine, label: filename, rel, isTarget: false });

    // Add target file if conversion exists
    const cached = pipelineCache[routine.id];
    if (cached?.conversion) {
      const targetLang = cached.conversion.target_language || 'Python';
      const ext = targetLang.toLowerCase() === 'python' ? '.py' : '.R';
      const targetFilename = filename.replace(/\.[a-zA-Z0-9]+$/, ext);
      const targetRel = rel.replace(/\.[a-zA-Z0-9]+$/, ext);
      node.files.push({ routineRef: routine, label: targetFilename, rel: targetRel, isTarget: true });
    }
  }
  return root;
}

// ─── FileTreeNode (recursive) ───────────────────────────────────────────────

function FileTreeNode({ node, routines, activeRoutine, onSelectRoutine, depth = 0, pipelineCache = {} }) {
=======
// ─── FileTreeNode (recursive) ───────────────────────────────────────────────

function FileTreeNode({ node, routines, activeRoutine, onSelectRoutine, depth = 0 }) {
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
  const [open, setOpen] = useState(true);
  const childNames = Object.keys(node.children);
  const hasContent = childNames.length > 0 || node.files.length > 0;

  if (!hasContent) return null;

  return (
    <div>
      {/* Folder row */}
      {node.name && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          className="w-full flex items-center gap-1.5 py-1 text-xs text-gh-textMuted hover:text-gh-text hover:bg-gh-surface/40 transition-colors"
        >
          {open ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
          {open
            ? <FolderOpen size={13} className="text-gh-yellow shrink-0" />
            : <Folder size={13} className="text-gh-yellow shrink-0" />
          }
          <span className="truncate font-medium">{node.name}</span>
        </button>
      )}

      {/* Contents */}
      {(open || !node.name) && (
        <>
          {/* Sub-folders */}
          {childNames.map(key => (
            <FileTreeNode
              key={key}
              node={node.children[key]}
              routines={routines}
              activeRoutine={activeRoutine}
              onSelectRoutine={onSelectRoutine}
              depth={node.name ? depth + 1 : depth}
<<<<<<< HEAD
              pipelineCache={pipelineCache}
=======
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
            />
          ))}

          {/* Files */}
<<<<<<< HEAD
          {node.files.map(({ routineRef, label, rel, isTarget }) => {
            // Use routineRef directly if available (from buildTreeFromRoutines),
            // otherwise fall back to name matching (from buildTree / upload preview)
            const routine = routineRef || routines.find(r => r.name === getRoutineName(label));
=======
          {node.files.map(({ file, label, rel }) => {
            // Try to match against a loaded routine by name
            const rname = getRoutineName(label);
            const routine = routines.find(r => r.name === rname);
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
            const isSelected = activeRoutine && routine && activeRoutine.id === routine.id;

            return (
              <button
                key={rel}
                onClick={() => routine && onSelectRoutine(routine)}
                style={{ paddingLeft: `${(node.name ? 20 + depth * 12 : 8) + 12}px` }}
                className={`w-full flex items-center gap-2 py-1 text-xs transition-colors group ${
                  isSelected
                    ? 'bg-gh-surface text-gh-text'
                    : routine
                    ? 'text-gh-textMuted hover:bg-gh-surface/50 hover:text-gh-text'
                    : 'text-gh-textSubtle cursor-default opacity-60'
                }`}
              >
<<<<<<< HEAD
                <FileCode size={13} className={isTarget ? 'text-gh-green shrink-0' : isSelected ? 'text-gh-orange shrink-0' : 'text-gh-textSubtle shrink-0'} />
                <span className="truncate flex-1 text-left font-mono">{label}</span>
                {routine && !isTarget && (
=======
                <FileCode size={13} className={isSelected ? 'text-gh-orange shrink-0' : 'text-gh-textSubtle shrink-0'} />
                <span className="truncate flex-1 text-left font-mono">{label}</span>
                {routine && (
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 mr-2 ${
                      routine.status === 'needs_review' ? 'bg-gh-yellow' :
                      routine.status === 'failed' ? 'bg-gh-red' : 'bg-gh-green'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── FlatRoutineList (fallback when no folder structure) ────────────────────

function FlatRoutineList({ routines, activeRoutine, onSelectRoutine, onUpload }) {
  if (routines.length === 0) {
    return (
      <div className="px-3 py-6 flex flex-col items-center gap-2 text-center">
        <div className="w-10 h-10 rounded-full bg-gh-surface flex items-center justify-center">
          <FileCode size={18} className="text-gh-textSubtle" />
        </div>
        <p className="text-xs text-gh-textSubtle">No routines yet</p>
        <button onClick={onUpload} className="text-xs text-gh-accent hover:underline">
          Upload your first file →
        </button>
      </div>
    );
  }

  return (
    <div className="pb-2">
      {routines.map((r) => {
        const isSelected = activeRoutine?.id === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onSelectRoutine(r)}
            className={`w-full px-3 py-1.5 flex items-center gap-2 text-xs transition-colors group ${
              isSelected
                ? 'bg-gh-surface text-gh-text'
                : 'text-gh-textMuted hover:bg-gh-surface/50 hover:text-gh-text'
            }`}
          >
            <FileCode size={13} className={isSelected ? 'text-gh-orange' : 'text-gh-textSubtle'} />
            <span className="truncate flex-1 text-left font-mono">{r.name}.m</span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                r.status === 'needs_review' ? 'bg-gh-yellow' :
                r.status === 'failed' ? 'bg-gh-red' : 'bg-gh-green'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SidebarFileTree({
  routines,
<<<<<<< HEAD
  allRoutines,
  activeRoutine,
  onSelectRoutine,
  onUploadRoutine,
  onUploadFiles,
  onRunPipeline,
  isProcessing,
  isUploading: isUploadingProp,
=======
  activeRoutine,
  onSelectRoutine,
  onUploadRoutine,
  onRunPipeline,
  isProcessing,
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
  targetLang,
  setTargetLang,
  pipelineProgress,
  pipelineStep,
  // Queue awareness (passed from App for status)
  uploadedFiles,          // [{ file, rel }] — the last batch uploaded (preserving folder structure)
  onSetUploadedFiles,     // setter so App can read the tree
  uploadRef,              // ref handle so MenuBar can open the upload modal
<<<<<<< HEAD
  pipelineCache = {},
  // Workspace props
  workspaces = [],
  activeWorkspaceId = null,
  onSelectWorkspace,
=======
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
}) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState('file');
  const [uploadName, setUploadName] = useState('');
  const [uploadCode, setUploadCode] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
<<<<<<< HEAD
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const isUploading = isUploadingLocal || Boolean(isUploadingProp);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [filterText, setFilterText] = useState('');
=======
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Expose openUpload(tab) so App/MenuBar can trigger the modal programmatically
  useImperativeHandle(uploadRef, () => ({
    openUpload(tab = 'file') {
      setUploadTab(tab);
      setShowUploadModal(true);
    },
  }));

  const readFileContent = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(f => /\.(m|mps|txt|mumps|rou|cob|cbl)$/i.test(f.name));
    setSelectedFiles(validFiles);
    setUploadStatus(null);
    if (validFiles.length === 0 && files.length > 0) {
      setUploadStatus({ type: 'error', message: 'No valid files found. Supported: .m, .mps, .txt, .mumps, .rou, .cob, .cbl' });
    }
  };

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(f => /\.(m|mps|txt|mumps|rou|cob|cbl)$/i.test(f.name));
    setSelectedFiles(validFiles);
    setUploadStatus(null);
    if (validFiles.length === 0) {
      setUploadStatus({ type: 'error', message: 'No MUMPS/COBOL files found in selected folder.' });
    } else {
      setUploadStatus({ type: 'success', message: `Found ${validFiles.length} file(s) ready to upload` });
    }
  };

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer?.items;
    const droppedFiles = [];

    if (items) {
      for (const item of items) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f && /\.(m|mps|txt|mumps|rou|cob|cbl)$/i.test(f.name)) {
            droppedFiles.push(f);
          }
        }
      }
    } else {
      // Fallback
      for (const f of e.dataTransfer.files) {
        if (/\.(m|mps|txt|mumps|rou|cob|cbl)$/i.test(f.name)) droppedFiles.push(f);
      }
    }

    if (droppedFiles.length > 0) {
      setSelectedFiles(droppedFiles);
      setUploadTab('file');
      setUploadStatus({ type: 'success', message: `Dropped ${droppedFiles.length} file(s) — ready to upload` });
      setShowUploadModal(true);
    }
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleFileUpload = async () => {
<<<<<<< HEAD
    if (selectedFiles.length === 0 || isUploading) return;
    setIsUploadingLocal(true);
    setUploadStatus(null);

=======
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    let uploadedCount = 0;
    // Propagate the file list (with relative paths) to App so the tree can be built
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
    if (onSetUploadedFiles) {
      onSetUploadedFiles(selectedFiles.map(f => ({
        file: f,
        rel: f.webkitRelativePath || f.name,
      })));
    }
<<<<<<< HEAD

    try {
      if (selectedFiles.length > 1 && onUploadFiles) {
        const fileRequests = await Promise.all(selectedFiles.map(async (file) => {
          const content = await readFileContent(file);
          const name = getRoutineName(file.name);
          const lang = detectLanguage(file.name);
          const relativePath = file.webkitRelativePath || file.name;
          return {
            name,
            raw_code: content,
            source_language: lang,
            relative_path: relativePath,
          };
        }));
        await onUploadFiles(fileRequests);
        setUploadStatus({ type: 'success', message: `✓ ${fileRequests.length} routine(s) uploaded successfully` });
      } else {
        let uploadedCount = 0;
        for (const file of selectedFiles) {
          const content = await readFileContent(file);
          const name = getRoutineName(file.name);
          const lang = detectLanguage(file.name);
          const relativePath = file.webkitRelativePath || file.name;
          await onUploadRoutine(name, content, lang, relativePath);
          uploadedCount++;
        }
        setUploadStatus({ type: 'success', message: `✓ ${uploadedCount} routine(s) uploaded successfully` });
      }
      setTimeout(() => {
        setShowUploadModal(false);
        resetModal();
      }, 1200);
    } catch (err) {
      setUploadStatus({ type: 'error', message: `Upload failed: ${err.message || err}` });
    } finally {
      setIsUploadingLocal(false);
    }
  };

  const handlePasteSubmit = async (e) => {
    e.preventDefault();
    if (!uploadName.trim() || !uploadCode.trim() || isUploading) return;
    setIsUploadingLocal(true);
    setUploadStatus(null);
    try {
      await onUploadRoutine(uploadName.trim(), uploadCode.trim());
      setUploadStatus({ type: 'success', message: '✓ Routine saved & uploaded successfully' });
      setTimeout(() => {
        setShowUploadModal(false);
        resetModal();
      }, 1000);
    } catch (err) {
      setUploadStatus({ type: 'error', message: `Upload failed: ${err.message || err}` });
    } finally {
      setIsUploadingLocal(false);
    }
=======
    try {
      for (const file of selectedFiles) {
        const content = await readFileContent(file);
        const name = getRoutineName(file.name);
        const lang = detectLanguage(file.name);
        await onUploadRoutine(name, content, lang);
        uploadedCount++;
      }
      setUploadStatus({ type: 'success', message: `✓ ${uploadedCount} routine(s) uploaded successfully` });
      setTimeout(() => { setShowUploadModal(false); resetModal(); }, 1200);
    } catch (err) {
      setUploadStatus({ type: 'error', message: `Upload failed after ${uploadedCount} file(s): ${err.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteSubmit = (e) => {
    e.preventDefault();
    if (!uploadName.trim() || !uploadCode.trim()) return;
    onUploadRoutine(uploadName.trim(), uploadCode.trim());
    setShowUploadModal(false);
    resetModal();
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
  };

  const resetModal = () => {
    setUploadName(''); setUploadCode(''); setSelectedFiles([]);
    setUploadStatus(null); setUploadTab('file');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const closeModal = () => { setShowUploadModal(false); resetModal(); };

  // ── Tree vs flat list ──────────────────────────────────────────────────────

<<<<<<< HEAD
  // Filter routines based on search text
  const filteredRoutines = routines.filter(r =>
    r.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (r.relative_path && r.relative_path.toLowerCase().includes(filterText.toLowerCase()))
  );

  // Build tree from persisted routines (survives browser refresh)
  // Any routine with a relative_path containing '/' has folder structure
  const hasAnyFolderPath = filteredRoutines.some(r => r.relative_path && r.relative_path.includes('/'));
  const treeData = hasAnyFolderPath ? buildTreeFromRoutines(filteredRoutines, pipelineCache) : null;
  const hasFolderStructure = treeData && Object.keys(treeData.children).length > 0;
=======
  // Build tree from the uploaded batch (if available)
  const treeData = uploadedFiles && uploadedFiles.length > 0
    ? buildTree(uploadedFiles.map(({ file }) => file))
    : null;

  const hasFolderStructure = treeData && (
    Object.keys(treeData.children).length > 0
  );
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab

  const tabs = [
    { id: 'file', label: 'Files', icon: FileUp },
    { id: 'folder', label: 'Folder', icon: FolderOpen },
    { id: 'paste', label: 'Paste', icon: ClipboardPaste },
  ];

  const canRun = !isProcessing && activeRoutine;

  return (
    <div
      ref={dropZoneRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`w-60 bg-gh-canvas border-r flex flex-col h-full select-none shrink-0 transition-colors ${
        isDragging ? 'border-gh-accent bg-gh-accentEmphasis/5' : 'border-gh-border'
      }`}
    >
      {/* Drop overlay hint */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="bg-gh-canvas/95 border-2 border-dashed border-gh-accent rounded-xl px-6 py-4 text-center">
            <Upload size={22} className="text-gh-accent mx-auto mb-2" />
            <p className="text-xs text-gh-accent font-semibold">Drop files to upload</p>
          </div>
        </div>
      )}

<<<<<<< HEAD
      {/* Explorer Header & Quick Action Buttons */}
      <div className="px-3 py-2 border-b border-gh-border flex items-center justify-between bg-gh-surface2">
        <span className="text-[10px] font-semibold text-gh-textSubtle tracking-widest uppercase">Explorer</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setUploadTab('file'); setShowUploadModal(true); }}
            title="Upload Files"
            className="w-5 h-5 rounded hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors"
          >
            <FileUp size={13} />
          </button>
          <button
            onClick={() => { setUploadTab('folder'); setShowUploadModal(true); }}
            title="Upload Folder"
            className="w-5 h-5 rounded hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors"
          >
            <FolderOpen size={13} />
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            title="Upload Routine Modal"
            className="w-5 h-5 rounded hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Workspace Tab Bar */}
      {workspaces.length > 0 && (
        <div className="border-b border-gh-border bg-gh-bg">
          <div className="flex overflow-x-auto scrollbar-none">
            {workspaces.map(ws => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => onSelectWorkspace && onSelectWorkspace(ws.id)}
                  title={ws.name}
                  className={`shrink-0 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors truncate max-w-[140px] ${
                    isActive
                      ? 'border-gh-accent text-gh-text bg-gh-surface/50'
                      : 'border-transparent text-gh-textMuted hover:text-gh-text hover:bg-gh-surface/30'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Folder size={11} className={isActive ? 'text-gh-accent' : 'text-gh-textSubtle'} />
                    {ws.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input Box */}
      <div className="px-3 py-2 border-b border-gh-border">
        <input
          type="text"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Search files..."
          className="w-full bg-gh-surface border border-gh-border rounded px-2.5 py-1 text-xs text-gh-text focus:outline-none focus:border-gh-accent placeholder:text-gh-textSubtle font-sans transition-all"
        />
=======
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gh-border flex justify-between items-center">
        <span className="text-[10px] font-semibold text-gh-textSubtle tracking-widest uppercase">Explorer</span>
        <button
          onClick={() => setShowUploadModal(true)}
          title="Upload Routine"
          className="w-6 h-6 rounded-md hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Target Language + Pipeline Controls */}
      <div className="p-3 border-b border-gh-border space-y-2.5">
        <div>
          <label className="block text-[10px] font-semibold text-gh-textSubtle uppercase tracking-wider mb-1.5">
            Target Language
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full bg-gh-bg border border-gh-border rounded-lg px-2.5 py-1.5 text-xs text-gh-text focus:outline-none focus:border-gh-accent transition-colors"
          >
            <option value="Python">Python 3.11+</option>
            <option value="R">R Language</option>
          </select>
        </div>

        {/* Pipeline button */}
        <button
          onClick={onRunPipeline}
          disabled={!canRun}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            canRun
              ? 'bg-gh-accent hover:bg-gh-accentHover text-white shadow-sm'
              : isProcessing
              ? 'bg-gh-accentEmphasis text-white cursor-not-allowed'
              : 'bg-gh-surface text-gh-textSubtle cursor-not-allowed border border-gh-border'
          }`}
        >
          {isProcessing ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin shrink-0">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span className="truncate">{pipelineStep || 'Processing…'}</span>
            </>
          ) : (
            <>
              <Play size={12} strokeWidth={2.5} />
              Run Pipeline
            </>
          )}
        </button>

        {/* Progress bar */}
        {isProcessing && pipelineProgress > 0 && (
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-gh-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gh-accent rounded-full transition-all duration-500"
                style={{ width: `${pipelineProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-gh-textSubtle text-right">{pipelineProgress}%</p>
          </div>
        )}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
      </div>

      {/* File Tree / Routine List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 flex items-center gap-1">
          <ChevronDown size={12} className="text-gh-textSubtle" />
          <span className="text-[10px] font-semibold text-gh-textSubtle uppercase tracking-wider">
<<<<<<< HEAD
            Routines ({filteredRoutines.length})
=======
            Routines ({routines.length})
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
          </span>
        </div>

        {hasFolderStructure ? (
          // Folder-aware tree view
          <FileTreeNode
            node={treeData}
<<<<<<< HEAD
            routines={filteredRoutines}
            activeRoutine={activeRoutine}
            onSelectRoutine={onSelectRoutine}
            depth={0}
            pipelineCache={pipelineCache}
=======
            routines={routines}
            activeRoutine={activeRoutine}
            onSelectRoutine={onSelectRoutine}
            depth={0}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
          />
        ) : (
          // Flat list (default / single files)
          <FlatRoutineList
<<<<<<< HEAD
            routines={filteredRoutines}
=======
            routines={routines}
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
            activeRoutine={activeRoutine}
            onSelectRoutine={onSelectRoutine}
            onUpload={() => setShowUploadModal(true)}
          />
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gh-canvas border border-gh-border rounded-2xl w-full max-w-lg shadow-modal animate-fadeInScale overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gh-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gh-accentEmphasis/20 border border-gh-accent/30 flex items-center justify-center">
                  <Upload size={14} className="text-gh-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gh-text">Upload Legacy Routine</h3>
                  <p className="text-xs text-gh-textMuted">MUMPS, COBOL — single files, multi-select, or whole folder</p>
                </div>
              </div>
              <button onClick={closeModal} className="w-7 h-7 rounded-lg hover:bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-gh-border bg-gh-bg">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setUploadTab(id); setUploadStatus(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all ${
                    uploadTab === id
                      ? 'text-gh-accent border-b-2 border-gh-accent bg-gh-canvas'
                      : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-canvas/50'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* ── File Tab ── */}
              {uploadTab === 'file' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gh-textMuted">
                    Select one or more <span className="text-gh-accent font-mono">.m</span>{' '}
                    <span className="text-gh-accent font-mono">.mps</span>{' '}
                    <span className="text-gh-accent font-mono">.txt</span> or COBOL{' '}
                    <span className="text-gh-accent font-mono">.cob</span> files, or drag-and-drop them anywhere on the sidebar.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".m,.mps,.txt,.mumps,.rou,.cob,.cbl"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 border-2 border-dashed border-gh-border hover:border-gh-accent rounded-xl flex flex-col items-center gap-2 text-gh-textMuted hover:text-gh-text transition-all hover:bg-gh-surface/30 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gh-accentEmphasis/10 border border-gh-accent/20 flex items-center justify-center group-hover:bg-gh-accentEmphasis/20 transition-colors">
                      <FileUp size={18} className="text-gh-accent" />
                    </div>
                    <span className="text-sm font-medium">Click to browse — or drag files here</span>
                    <span className="text-xs text-gh-textSubtle">.m · .mps · .txt · .cob · .cbl · multiple allowed</span>
                  </button>

                  {selectedFiles.length > 0 && (
                    <div className="bg-gh-bg rounded-xl border border-gh-border p-3 max-h-36 overflow-y-auto space-y-1">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5 text-xs text-gh-text">
                          <FileCode size={12} className="text-gh-orange shrink-0" />
                          <span className="truncate font-mono">{f.webkitRelativePath || f.name}</span>
                          <span className="text-gh-textSubtle ml-auto text-[10px] font-mono shrink-0">{(f.size / 1024).toFixed(1)}KB</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadStatus && (
                    <div className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border ${
                      uploadStatus.type === 'success'
                        ? 'bg-gh-greenBg text-gh-green border-gh-greenDim/30'
                        : 'bg-gh-redBg text-gh-red border-gh-red/20'
                    }`}>
                      {uploadStatus.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {uploadStatus.message}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button onClick={closeModal} className="px-3 py-1.5 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-text rounded-lg text-xs transition-colors">Cancel</button>
                    <button
                      onClick={handleFileUpload}
                      disabled={selectedFiles.length === 0 || isUploading}
                      className="px-4 py-1.5 bg-gh-accent hover:bg-gh-accentHover text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      {isUploading
                        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading…</>
                        : <><Upload size={11} /> Upload ({selectedFiles.length || 0})</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ── Folder Tab ── */}
              {uploadTab === 'folder' && (
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gh-textMuted">
                    Select an entire folder — relative file paths are preserved in the Explorer tree.
                    Sub-folders are shown as collapsible groups.
                  </p>
                  <input ref={folderInputRef} type="file" webkitdirectory="" directory="" onChange={handleFolderSelect} className="hidden" />
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full py-8 border-2 border-dashed border-gh-border hover:border-gh-accent rounded-xl flex flex-col items-center gap-2 text-gh-textMuted hover:text-gh-text transition-all hover:bg-gh-surface/30 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gh-accentEmphasis/10 border border-gh-accent/20 flex items-center justify-center group-hover:bg-gh-accentEmphasis/20 transition-colors">
                      <FolderOpen size={18} className="text-gh-accent" />
                    </div>
                    <span className="text-sm font-medium">Click to select folder</span>
                    <span className="text-xs text-gh-textSubtle">Folder structure preserved in sidebar</span>
                  </button>

                  {selectedFiles.length > 0 && (
                    <div className="bg-gh-bg rounded-xl border border-gh-border p-3 max-h-36 overflow-y-auto space-y-1">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5 text-xs text-gh-text">
                          <FileCode size={12} className="text-gh-orange shrink-0" />
                          <span className="truncate font-mono">{f.webkitRelativePath || f.name}</span>
                          <span className="text-gh-textSubtle ml-auto text-[10px] font-mono shrink-0">{(f.size / 1024).toFixed(1)}KB</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadStatus && (
                    <div className={`flex items-center gap-2 text-xs p-2.5 rounded-lg border ${
                      uploadStatus.type === 'success'
                        ? 'bg-gh-greenBg text-gh-green border-gh-greenDim/30'
                        : 'bg-gh-redBg text-gh-red border-gh-red/20'
                    }`}>
                      {uploadStatus.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {uploadStatus.message}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button onClick={closeModal} className="px-3 py-1.5 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-text rounded-lg text-xs transition-colors">Cancel</button>
                    <button
                      onClick={handleFileUpload}
                      disabled={selectedFiles.length === 0 || isUploading}
                      className="px-4 py-1.5 bg-gh-accent hover:bg-gh-accentHover text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      {isUploading
                        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading…</>
                        : <><Upload size={11} /> Upload All ({selectedFiles.length})</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ── Paste Tab ── */}
              {uploadTab === 'paste' && (
                <form onSubmit={handlePasteSubmit} className="flex flex-col gap-3">
                  <p className="text-xs text-gh-textMuted">Manually enter routine name and paste source code.</p>
                  <div>
                    <label className="block text-xs font-medium text-gh-textMuted mb-1">Routine Name</label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="e.g. PSOHLDS"
                      className="w-full bg-gh-bg border border-gh-border rounded-lg px-3 py-2 text-xs text-gh-text focus:outline-none focus:border-gh-accent font-mono transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gh-textMuted mb-1">Source Code</label>
                    <textarea
                      value={uploadCode}
                      onChange={(e) => setUploadCode(e.target.value)}
                      rows={8}
                      placeholder="Paste MUMPS or COBOL source code here…"
                      className="w-full bg-gh-bg border border-gh-border rounded-lg px-3 py-2 font-mono text-xs text-gh-text focus:outline-none focus:border-gh-accent resize-none transition-colors"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={closeModal} className="px-3 py-1.5 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-text rounded-lg text-xs transition-colors">Cancel</button>
                    <button
                      type="submit"
<<<<<<< HEAD
                      disabled={!uploadName.trim() || !uploadCode.trim() || isUploading}
                      className="px-4 py-1.5 bg-gh-accent hover:bg-gh-accentHover text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      {isUploading
                        ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading…</>
                        : <><Upload size={11} /> Save & Process</>
                      }
=======
                      disabled={!uploadName.trim() || !uploadCode.trim()}
                      className="px-4 py-1.5 bg-gh-accent hover:bg-gh-accentHover text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      <Upload size={11} /> Save & Process
>>>>>>> 0547345875cd943935a856f3d336a0ebc97837ab
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
