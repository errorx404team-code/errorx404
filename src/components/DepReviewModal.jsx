import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, Search, X,
  AlertTriangle, CheckCircle, Circle, Loader,
  ChevronDown, ChevronRight, Play, ArrowLeft,
  Network, Info, RefreshCw, Layers, FileCode
} from 'lucide-react';

// ── Node/edge style constants ────────────────────────────────────────────────
const NODE_TYPE_STYLES = {
  routine:          { bg: '#1c2a3a', border: '#388bfd', text: '#79c0ff', label: 'routine' },
  function:         { bg: '#1c2a3a', border: '#388bfd', text: '#79c0ff', label: 'fn'      },
  tag:              { bg: '#1c2a3a', border: '#388bfd', text: '#79c0ff', label: 'tag'     },
  global_variable:  { bg: '#2a1f3a', border: '#a371f7', text: '#d2a8ff', label: 'global'  },
  external_routine: { bg: '#1e2d1e', border: '#3fb950', text: '#7ee787', label: 'extern'  },
  table:            { bg: '#2d2a1a', border: '#d29922', text: '#e3b341', label: 'table'   },
  api:              { bg: '#2d1a1a', border: '#f85149', text: '#ffa198', label: 'api'     },
  config:           { bg: '#1a2a2a', border: '#39d5cf', text: '#72e4e0', label: 'cfg'     },
};
const EDGE_COLORS = {
  CALLS: '#388bfd', READS: '#3fb950', WRITES: '#d29922',
  USES_GLOBAL: '#a371f7', member: '#57606a', cross_file: '#39d5cf',
  USES_TABLE: '#d29922', USES_API: '#f85149',
};
const NODE_W = 136, NODE_H = 44, COL_W = 210, ROW_H = 82;

// ── Layout ───────────────────────────────────────────────────────────────────
function computeLayout(nodes, edges) {
  if (!nodes.length) return { nodes: [], edges };
  const ORDER = ['routine','function','tag','external_routine','global_variable','table','api','config'];
  const buckets = {};
  ORDER.forEach(t => { buckets[t] = []; });
  nodes.forEach(n => {
    const t = n.node_type || n.type || 'function';
    if (!buckets[t]) buckets[t] = [];
    buckets[t].push(n);
  });
  const cols = ORDER.filter(t => buckets[t].length > 0);
  const degMap = {};
  (edges||[]).forEach(e => {
    degMap[e.source] = (degMap[e.source]||0)+1;
    degMap[e.target] = (degMap[e.target]||0)+1;
  });
  const laid = [];
  cols.forEach((type, ci) => {
    buckets[type].forEach((n, ri) => {
      laid.push({
        ...n,
        x: ci * COL_W + 20,
        y: ri * ROW_H + 20,
        degree: degMap[n.id] || 0,
      });
    });
  });
  return { nodes: laid, edges: edges||[] };
}

// ── Edge component ───────────────────────────────────────────────────────────
function Edge({ e, src, tgt, hilite }) {
  if (!src || !tgt) return null;
  const rel = e.relationship || 'default';
  const col = EDGE_COLORS[rel] || '#57606a';
  const x1=src.x+NODE_W/2, y1=src.y+NODE_H/2, x2=tgt.x+NODE_W/2, y2=tgt.y+NODE_H/2;
  const mk=`arr-${rel.replace(/[^a-zA-Z]/g,'')}`;
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={col} strokeWidth={hilite?2:1}
      strokeOpacity={hilite?1:.5}
      markerEnd={`url(#${mk})`}/>
  );
}

// ── Node component ───────────────────────────────────────────────────────────
function Node({ n, sel, onSel, onDrag, highCoup }) {
  const t = n.node_type || n.type || 'function';
  const s = NODE_TYPE_STYLES[t] || NODE_TYPE_STYLES.function;
  const hi = isFinite(highCoup) && n.degree >= highCoup;
  return (
    <g transform={`translate(${n.x},${n.y})`}
       style={{cursor:'pointer'}} onClick={onSel} onMouseDown={ev=>onDrag(ev,n)}>
      <rect width={NODE_W} height={NODE_H} rx={6}
        fill={s.bg} stroke={hi?'#d29922':sel?'#e3b341':s.border}
        strokeWidth={sel||hi?2:1.5}/>
      {hi && <rect width={NODE_W} height={3} rx={1.5} y={NODE_H-3} fill="#d29922" opacity={.7}/>}
      <text x={NODE_W/2} y={13} textAnchor="middle" fontSize={8} fill={s.text} fontWeight="600" opacity={.8}>
        {s.label.toUpperCase()}
      </text>
      <text x={NODE_W/2} y={29} textAnchor="middle" fontSize={10} fill={sel?'#fff':s.text} fontWeight="500">
        {(n.label||n.id||'').length>15?(n.label||n.id||'').slice(0,13)+'…':(n.label||n.id||'')}
      </text>
    </g>
  );
}

// ── Pipeline stage tracker ────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id:'analyze', label:'Analyze Code' },
  { id:'deps',    label:'Dep Graph'    },
  { id:'logic',   label:'Business Map' },
  { id:'review',  label:'Review'       },
];
function PipelineStatus({ currentStage }) {
  const idx = PIPELINE_STAGES.findIndex(s=>s.id===currentStage);
  return (
    <div className="flex flex-col gap-2">
      {PIPELINE_STAGES.map((s,i)=>{
        const done  = i < idx;
        const active= i === idx;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              done   ? 'bg-gh-green'  :
              active ? 'bg-gh-accent' : 'bg-gh-surface2'}`}>
              {done   && <CheckCircle size={9} className="text-white"/>}
              {active && <Loader size={9} className="animate-spin text-white"/>}
              {!done&&!active && <Circle size={9} className="text-gh-textSubtle"/>}
            </div>
            <span className={`text-[11px] ${done?'text-gh-green':active?'text-gh-accent':'text-gh-textSubtle'}`}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Node detail side-panel ────────────────────────────────────────────────────
function NodeDetail({ node, edges, onClose }) {
  const t = node.node_type || node.type || 'function';
  const s = NODE_TYPE_STYLES[t] || NODE_TYPE_STYLES.function;
  const inc = edges.filter(e=>e.target===node.id).map(e=>e.source);
  const out = edges.filter(e=>e.source===node.id).map(e=>e.target);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gh-text truncate max-w-[140px]"
              title={node.label||node.id}>{node.label||node.id}</span>
        <button onClick={onClose}><X size={11} className="text-gh-textSubtle hover:text-gh-text"/></button>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
              style={{background:s.bg,color:s.text,border:`1px solid ${s.border}`}}>
          {s.label.toUpperCase()}
        </span>
        <span className="text-[9px] text-gh-textSubtle">degree {node.degree}</span>
      </div>
      {node.source_line && (
        <p className="text-[10px] text-gh-textSubtle font-mono mb-2">Line {node.source_line}</p>
      )}
      {inc.length>0 && (
        <div className="mb-1.5">
          <p className="text-[9px] font-semibold text-gh-textSubtle uppercase mb-0.5">Called by</p>
          {inc.slice(0,4).map(id=>(
            <p key={id} className="text-[10px] text-gh-textMuted font-mono truncate">{id}</p>
          ))}
          {inc.length>4 && <p className="text-[9px] text-gh-textSubtle">+{inc.length-4} more</p>}
        </div>
      )}
      {out.length>0 && (
        <div>
          <p className="text-[9px] font-semibold text-gh-textSubtle uppercase mb-0.5">Calls</p>
          {out.slice(0,4).map(id=>(
            <p key={id} className="text-[10px] text-gh-textMuted font-mono truncate">{id}</p>
          ))}
          {out.length>4 && <p className="text-[9px] text-gh-textSubtle">+{out.length-4} more</p>}
        </div>
      )}
    </div>
  );
}

// ── Per-file status badge ─────────────────────────────────────────────────────
function FileStatusBadge({ status }) {
  if (status === 'completed') return <CheckCircle size={12} className="text-gh-green shrink-0"/>;
  if (status === 'failed')    return <AlertTriangle size={12} className="text-gh-red shrink-0"/>;
  if (status === 'analyzing') return <Loader size={12} className="animate-spin text-gh-accent shrink-0"/>;
  return <Circle size={12} className="text-gh-textSubtle shrink-0"/>;
}

// ── SVG Graph canvas (reusable) ───────────────────────────────────────────────
function GraphCanvas({ depData, isAnalyzing, analyzeStage }) {
  const svgRef   = useRef(null);
  const [zoom,    setZoom]    = useState(1);
  const [pan,     setPan]     = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef(null);
  const [selNode, setSelNode] = useState(null);
  const [search,  setSearch]  = useState('');
  const [layout,  setLayout]  = useState(null);
  const [dragId,  setDragId]  = useState(null);
  const dragOff = useRef({ dx:0, dy:0 });

  useEffect(() => {
    if (depData?.nodes?.length) {
      setLayout(computeLayout(depData.nodes, depData.edges || []));
      setSelNode(null);
    } else {
      setLayout(null);
    }
  }, [depData]);

  const highCoup = layout
    ? (() => {
        const s = [...layout.nodes].sort((a,b)=>b.degree-a.degree);
        return s.length>3 ? s[Math.floor(s.length*.2)].degree : Infinity;
      })()
    : Infinity;

  const visNodes = (layout?.nodes||[]).filter(n =>
    !search || (n.label||n.id).toLowerCase().includes(search.toLowerCase())
  );
  const visIds = new Set(visNodes.map(n=>n.id));
  const visEdges = (layout?.edges||[]).filter(e => visIds.has(e.source) && visIds.has(e.target));
  const nodeMap  = new Map((layout?.nodes||[]).map(n=>[n.id,n]));
  const relTypes = [...new Set((layout?.edges||[]).map(e=>e.relationship))].filter(Boolean);
  const totalNodes = layout?.nodes.length || 0;

  const zoomIn  = () => setZoom(z=>Math.min(z+.2,3));
  const zoomOut = () => setZoom(z=>Math.max(z-.2,.25));
  const fitView = useCallback(() => { setZoom(1); setPan({x:0,y:0}); }, []);

  const onMD = useCallback(e => {
    if (e.target===svgRef.current||e.target.tagName==='svg') {
      setPanning(true);
      panStart.current = { sx:e.clientX-pan.x, sy:e.clientY-pan.y };
      setSelNode(null);
    }
  }, [pan]);
  const onMM = useCallback(e => {
    if (panning && panStart.current) setPan({x:e.clientX-panStart.current.sx, y:e.clientY-panStart.current.sy});
    if (dragId && layout) {
      const rect=svgRef.current?.getBoundingClientRect();
      if (rect) {
        const nx=(e.clientX-rect.left-pan.x)/zoom - dragOff.current.dx;
        const ny=(e.clientY-rect.top -pan.y)/zoom - dragOff.current.dy;
        setLayout(prev=>({...prev, nodes:prev.nodes.map(n=>n.id===dragId?{...n,x:nx,y:ny}:n)}));
      }
    }
  }, [panning, dragId, zoom, pan, layout]);
  const onMU = useCallback(() => { setPanning(false); panStart.current=null; setDragId(null); }, []);
  const onNodeDrag = useCallback((e, node) => {
    e.stopPropagation();
    const rect=svgRef.current?.getBoundingClientRect();
    if (rect) dragOff.current={ dx:(e.clientX-rect.left-pan.x)/zoom-node.x, dy:(e.clientY-rect.top-pan.y)/zoom-node.y };
    setDragId(node.id);
  }, [zoom, pan]);

  const onWheel = useCallback(e => { e.preventDefault(); setZoom(z=>Math.max(.25,Math.min(3,z+(e.deltaY<0?.1:-.1)))); }, []);
  useEffect(() => {
    const el=svgRef.current; if(!el) return;
    el.addEventListener('wheel', onWheel, {passive:false});
    return ()=>el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const selectedNodeData = selNode ? nodeMap.get(selNode) : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gh-border bg-gh-surface2 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gh-bg border border-gh-border rounded-lg px-2 py-0.5">
          <Search size={10} className="text-gh-textSubtle"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="w-28 text-[10px] bg-transparent text-gh-text placeholder:text-gh-textSubtle focus:outline-none"/>
          {search && <button onClick={()=>setSearch('')}><X size={9} className="text-gh-textSubtle"/></button>}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={zoomOut} className="w-6 h-6 rounded border border-gh-border bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text hover:bg-gh-surface2 transition-colors"><ZoomOut size={10}/></button>
          <span className="text-[10px] font-mono text-gh-textSubtle w-9 text-center">{Math.round(zoom*100)}%</span>
          <button onClick={zoomIn}  className="w-6 h-6 rounded border border-gh-border bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text hover:bg-gh-surface2 transition-colors"><ZoomIn  size={10}/></button>
          <button onClick={fitView} title="Fit to screen" className="w-6 h-6 rounded border border-gh-border bg-gh-surface flex items-center justify-center text-gh-textMuted hover:text-gh-text hover:bg-gh-surface2 transition-colors"><Maximize2 size={10}/></button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {isAnalyzing && !totalNodes ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Loader size={28} className="text-gh-accent animate-spin"/>
            <div className="text-center">
              <p className="text-sm font-semibold text-gh-text">
                {analyzeStage==='analyze' && 'Analyzing MUMPS code…'}
                {analyzeStage==='deps'    && 'Building dependency graph…'}
                {analyzeStage==='logic'   && 'Mapping business logic…'}
                {analyzeStage==='review'  && 'Generating AI summary…'}
              </p>
              <p className="text-xs text-gh-textMuted mt-1">Please wait — this takes a few seconds.</p>
            </div>
          </div>
        ) : !totalNodes ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
            <Network size={32} className="text-gh-textSubtle opacity-30"/>
            <p className="text-sm text-gh-textSubtle">No dependency data available.</p>
          </div>
        ) : (
          <svg ref={svgRef} width="100%" height="100%"
            className={`absolute inset-0 ${panning?'cursor-grabbing':'cursor-grab'}`}
            onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
            <defs>
              {Object.entries(EDGE_COLORS).map(([rel,col])=>(
                <marker key={rel} id={`arr-${rel.replace(/[^a-zA-Z]/g,'')}`}
                  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill={col}/>
                </marker>
              ))}
              <marker id="arr-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#57606a"/>
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {visEdges.map((e,i)=>(
                <Edge key={i} e={e} src={nodeMap.get(e.source)} tgt={nodeMap.get(e.target)}
                  hilite={selNode===e.source||selNode===e.target}/>
              ))}
              {visNodes.map(n=>(
                <Node key={n.id} n={n} sel={selNode===n.id} highCoup={highCoup}
                  onSel={()=>setSelNode(prev=>prev===n.id?null:n.id)}
                  onDrag={ev=>onNodeDrag(ev,n)}/>
              ))}
            </g>
          </svg>
        )}

        {/* Floating node detail */}
        {selectedNodeData && (
          <div className="absolute top-3 right-3 w-56 bg-gh-canvas border border-gh-border rounded-xl shadow-modal p-3 z-10"
               style={{animation:'fadeIn .15s ease'}}>
            <NodeDetail node={selectedNodeData} edges={layout?.edges||[]}
              onClose={()=>setSelNode(null)}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function DepReviewModal({
  // Single-file props
  routineName,
  depData,           // { nodes, edges } for the active/selected file
  partitionData,
  specData,
  isAnalyzing,
  analyzeStage,      // 'analyze' | 'deps' | 'logic' | 'review'
  aiSummary,         // plain-text AI summary
  onBack,
  onConfirmConvert,  // single-file confirm

  // Multi-file (batch) props — optional
  isBatchMode,          // bool — true when opened from project pipeline
  workspaceRoutines,    // [{ id, name }]
  fileStatuses,         // { [routineId]: 'pending'|'analyzing'|'completed'|'failed' }
  fileDepData,          // { [routineId]: { nodes, edges } }
  workspaceDepData,     // merged workspace graph { nodes, edges }
  onRetryFile,          // (routineId) => void
  onConfirmBatchConvert,// () => void
}) {
  const [showMore,    setShowMore]    = useState(false);
  const [graphView,   setGraphView]   = useState('current'); // 'current' | 'workspace'
  const [selectedFileId, setSelectedFileId] = useState(null);

  // In batch mode, active dep data is either workspace or the selected file's data
  const activeDepData = isBatchMode
    ? (graphView === 'workspace'
        ? workspaceDepData
        : (selectedFileId ? fileDepData?.[selectedFileId] : workspaceDepData))
    : depData;

  // Stats derived from currently shown graph
  const activeNodes = activeDepData?.nodes?.length || 0;
  const activeEdges = activeDepData?.edges?.length || 0;
  const crossFileCount = (activeDepData?.edges||[]).filter(e=>e.cross_file).length;

  // High-coupling for footer warning (simplified — just count from current view)
  const highCoupCount = (() => {
    const nodes = activeDepData?.nodes || [];
    const edges = activeDepData?.edges || [];
    if (!nodes.length) return 0;
    const degMap = {};
    edges.forEach(e => { degMap[e.source]=(degMap[e.source]||0)+1; degMap[e.target]=(degMap[e.target]||0)+1; });
    const degs = nodes.map(n => degMap[n.id]||0).sort((a,b)=>b-a);
    const threshold = degs.length > 3 ? degs[Math.floor(degs.length*.2)] : Infinity;
    return isFinite(threshold) ? nodes.filter(n=>(degMap[n.id]||0)>=threshold).length : 0;
  })();

  const summaryShort = aiSummary
    ? aiSummary.split('\n').filter(l=>l.trim()).slice(0,4).join('\n')
    : null;
  const summaryFull = aiSummary || null;

  // Batch status summary
  const totalFiles   = workspaceRoutines?.length || 0;
  const doneFiles    = totalFiles ? Object.values(fileStatuses||{}).filter(s=>s==='completed').length : 0;
  const failedFiles  = totalFiles ? Object.values(fileStatuses||{}).filter(s=>s==='failed').length : 0;
  const allDone      = totalFiles > 0 && (doneFiles + failedFiles) === totalFiles;

  const confirmDisabled = isBatchMode ? (!allDone || isAnalyzing) : isAnalyzing;
  const confirmLabel    = isBatchMode
    ? `Confirm & Convert ${doneFiles} File${doneFiles!==1?'s':''} to Python`
    : 'Confirm & Convert to Python';
  const confirmHandler  = isBatchMode ? onConfirmBatchConvert : onConfirmConvert;

  const displayRoutineName = isBatchMode
    ? `${totalFiles} file${totalFiles!==1?'s':''} — workspace`
    : routineName;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gh-bg" style={{animation:'depModalIn .18s ease'}}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-gh-canvas border-b border-gh-border shrink-0">
        <div className="flex items-center gap-3">
          <Network size={18} className="text-gh-accent"/>
          <div>
            <h2 className="text-sm font-semibold text-gh-text">Dependency Analysis</h2>
            <p className="text-[11px] text-gh-textSubtle mt-0.5">{displayRoutineName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAnalyzing && (
            <span className="flex items-center gap-1.5 text-xs text-gh-accent">
              <Loader size={12} className="animate-spin"/>
              Analyzing…
            </span>
          )}
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-textMuted hover:text-gh-text rounded-lg text-xs transition-colors">
            <ArrowLeft size={12}/> Back to editor
          </button>
        </div>
      </div>

      {/* ── Main body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left sidebar ────────────────────────────────────────────────────── */}
        <div className="w-52 shrink-0 border-r border-gh-border bg-gh-canvas flex flex-col overflow-y-auto">

          {/* Pipeline progress (single-file) or batch progress (multi-file) */}
          <div className="p-4 border-b border-gh-border">
            {isBatchMode ? (
              <>
                <p className="text-[10px] font-semibold text-gh-textSubtle uppercase tracking-wider mb-3">
                  File Status
                </p>
                {(workspaceRoutines||[]).map(r => {
                  const st = fileStatuses?.[r.id] || 'pending';
                  return (
                    <div key={r.id}
                         onClick={() => { setSelectedFileId(r.id); setGraphView('current'); }}
                         className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer mb-1 transition-colors
                           ${selectedFileId===r.id ? 'bg-gh-surface2 text-gh-text' : 'hover:bg-gh-surface text-gh-textMuted'}`}>
                      <FileStatusBadge status={st}/>
                      <span className="text-[11px] truncate flex-1 font-mono">{r.name}</span>
                      {st === 'failed' && onRetryFile && (
                        <button
                          onClick={e => { e.stopPropagation(); onRetryFile(r.id); }}
                          title="Retry analysis"
                          className="shrink-0 text-gh-textSubtle hover:text-gh-accent transition-colors">
                          <RefreshCw size={10}/>
                        </button>
                      )}
                    </div>
                  );
                })}
                {totalFiles > 0 && (
                  <p className="text-[10px] text-gh-textSubtle mt-2 pt-2 border-t border-gh-border">
                    {doneFiles}/{totalFiles} analyzed
                    {failedFiles > 0 && <span className="text-gh-red ml-1">({failedFiles} failed)</span>}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold text-gh-textSubtle uppercase tracking-wider mb-3">
                  Pipeline Progress
                </p>
                <PipelineStatus currentStage={analyzeStage}/>
              </>
            )}
          </div>

          {/* Edge legend */}
          {activeNodes > 0 && (
            <div className="p-4 border-b border-gh-border">
              <p className="text-[10px] font-semibold text-gh-textSubtle uppercase tracking-wider mb-2">
                Edge Types
              </p>
              <div className="flex flex-col gap-1.5">
                {Object.entries(EDGE_COLORS).slice(0,6).map(([rel,col])=>(
                  <div key={rel} className="flex items-center gap-2 text-[10px] text-gh-textSubtle">
                    <div className="w-6 h-px" style={{background:col}}/>
                    <span className="font-mono">{rel}</span>
                  </div>
                ))}
                {highCoupCount > 0 && (
                  <div className="flex items-center gap-2 text-[10px] text-gh-yellow mt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-gh-yellow shrink-0"/>
                    High coupling ({highCoupCount})
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          {activeNodes > 0 && (
            <div className="p-4 text-[10px] text-gh-textSubtle space-y-1 font-mono">
              <p>Nodes: <span className="text-gh-text font-semibold">{activeNodes}</span></p>
              <p>Edges: <span className="text-gh-text font-semibold">{activeEdges}</span></p>
              {crossFileCount>0 && (
                <p className="text-gh-accent">Cross-file: <span className="font-semibold">{crossFileCount}</span></p>
              )}
            </div>
          )}
        </div>

        {/* Center — graph + AI explanation ───────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Graph view switcher (batch mode only) */}
          {isBatchMode && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gh-border bg-gh-canvas shrink-0">
              <button
                onClick={() => setGraphView('workspace')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  graphView==='workspace'
                    ? 'bg-gh-accent text-white'
                    : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-surface'}`}>
                <Layers size={11}/>
                Workspace Graph
              </button>
              <button
                onClick={() => setGraphView('current')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  graphView==='current'
                    ? 'bg-gh-accent text-white'
                    : 'text-gh-textMuted hover:text-gh-text hover:bg-gh-surface'}`}>
                <FileCode size={11}/>
                {selectedFileId
                  ? (workspaceRoutines?.find(r=>r.id===selectedFileId)?.name || 'Selected File')
                  : 'Select a file'}
              </button>
              {graphView==='current' && !selectedFileId && (
                <span className="text-[10px] text-gh-textSubtle italic ml-2">
                  Click a file in the sidebar to view its graph
                </span>
              )}
            </div>
          )}

          {/* Graph canvas */}
          <GraphCanvas
            depData={activeDepData}
            isAnalyzing={isAnalyzing}
            analyzeStage={analyzeStage}
          />

          {/* AI Understanding panel */}
          {(summaryShort || isAnalyzing) && (
            <div className="border-t border-gh-border bg-gh-canvas/70 shrink-0 px-5 py-3"
                 style={{maxHeight:'180px', overflowY:'auto'}}>
              <div className="flex items-center gap-2 mb-2">
                <Info size={12} className="text-gh-textSubtle"/>
                <span className="text-[11px] font-semibold text-gh-textSubtle">AI Understanding</span>
              </div>
              {isAnalyzing && !summaryShort ? (
                <p className="text-[11px] text-gh-textSubtle italic">Generating explanation…</p>
              ) : summaryShort ? (
                <>
                  <p className="text-[12px] text-gh-textMuted leading-relaxed whitespace-pre-line">
                    {showMore ? summaryFull : summaryShort}
                  </p>
                  {summaryFull && summaryFull !== summaryShort && (
                    <button onClick={()=>setShowMore(v=>!v)}
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-gh-accent hover:text-gh-accentHover transition-colors">
                      {showMore ? <><ChevronRight size={10}/> Show less</> : <><ChevronDown size={10}/> Show more</>}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gh-border bg-gh-canvas shrink-0">
        <div className="flex items-center gap-3">
          {highCoupCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-gh-yellow">
              <AlertTriangle size={12}/>
              {highCoupCount} high-coupling node{highCoupCount>1?'s':''} — review before converting
            </div>
          )}
          {crossFileCount > 0 && !highCoupCount && (
            <div className="flex items-center gap-1.5 text-[11px] text-gh-accent">
              <Info size={12}/>
              {crossFileCount} cross-file {crossFileCount>1?'dependencies':'dependency'} found
            </div>
          )}
          {isBatchMode && failedFiles > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-gh-red">
              <AlertTriangle size={12}/>
              {failedFiles} file{failedFiles>1?'s':''} failed analysis — use retry buttons
            </div>
          )}
          {!isAnalyzing && !highCoupCount && !crossFileCount && activeNodes>0 && !failedFiles && (
            <div className="flex items-center gap-1.5 text-[11px] text-gh-green">
              <CheckCircle size={12}/>
              {isBatchMode ? `All ${doneFiles} files analyzed — ready to convert` : 'Analysis complete — no issues detected'}
            </div>
          )}
          {isAnalyzing && (
            <span className="text-[11px] text-gh-textSubtle italic">
              {isBatchMode ? `Analyzing files… (${doneFiles}/${totalFiles} done)` : 'Analysis in progress…'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-textMuted hover:text-gh-text rounded-lg text-sm font-medium transition-colors">
            <ArrowLeft size={13}/> Back
          </button>
          <button
            onClick={confirmHandler}
            disabled={confirmDisabled}
            className="flex items-center gap-2 px-5 py-2 bg-gh-accent hover:bg-gh-accentHover disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            <Play size={13} fill="currentColor"/>
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes depModalIn {
          from { opacity:0; transform:scale(0.99); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
