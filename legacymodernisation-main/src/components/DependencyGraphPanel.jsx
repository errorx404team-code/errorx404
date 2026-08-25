import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, Search, Play,
  AlertTriangle, CheckCircle, Network, X, Info, ArrowRight, RefreshCw
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────

const NODE_TYPE_STYLES = {
  routine:          { bg: '#1c2a3a', border: '#388bfd', text: '#79c0ff', label: 'routine' },
  function:         { bg: '#1c2a3a', border: '#388bfd', text: '#79c0ff', label: 'fn' },
  tag:              { bg: '#1c2a3a', border: '#388bfd', text: '#79c0ff', label: 'tag' },
  global_variable:  { bg: '#2a1f3a', border: '#a371f7', text: '#d2a8ff', label: 'global' },
  external_routine: { bg: '#1e2d1e', border: '#3fb950', text: '#7ee787', label: 'extern' },
  table:            { bg: '#2d2a1a', border: '#d29922', text: '#e3b341', label: 'table' },
  api:              { bg: '#2d1a1a', border: '#f85149', text: '#ffa198', label: 'api' },
  config:           { bg: '#1a2a2a', border: '#39d5cf', text: '#72e4e0', label: 'cfg' },
};

const EDGE_TYPE_COLORS = {
  CALLS:          '#388bfd',
  READS:          '#3fb950',
  WRITES:         '#d29922',
  USES_GLOBAL:    '#a371f7',
  member:         '#57606a',
  USES_TABLE:     '#d29922',
  USES_API:       '#f85149',
  cross_file:     '#39d5cf',
};

const NODE_W = 130;
const NODE_H = 42;
const GRID_COL_W = 200;
const GRID_ROW_H = 80;

// ── Layout Engine (hierarchical grid) ──────────────────────────────────────

function computeLayout(nodes, edges) {
  if (!nodes.length) return { nodes: [], edges, width: 600, height: 400 };

  // Group nodes by type for visual layering
  const typeOrder = ['routine', 'function', 'tag', 'external_routine', 'global_variable', 'table', 'api', 'config'];
  const grouped = {};
  for (const n of nodes) {
    const g = typeOrder.includes(n.type) ? n.type : 'function';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(n);
  }

  // Build adjacency for degree centrality (high coupling = placed centrally)
  const degree = {};
  for (const n of nodes) degree[n.id] = 0;
  for (const e of edges) {
    if (degree[e.source] !== undefined) degree[e.source]++;
    if (degree[e.target] !== undefined) degree[e.target]++;
  }

  const placed = new Map();
  let col = 0;
  for (const type of typeOrder) {
    if (!grouped[type]) continue;
    // Sort by degree descending within each column
    grouped[type].sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0));
    grouped[type].forEach((n, row) => {
      placed.set(n.id, {
        x: 40 + col * GRID_COL_W,
        y: 30 + row * GRID_ROW_H,
      });
    });
    col++;
  }

  const layoutNodes = nodes.map(n => ({
    ...n,
    x: placed.has(n.id) ? placed.get(n.id).x : 40,
    y: placed.has(n.id) ? placed.get(n.id).y : 40,
    degree: degree[n.id] || 0,
  }));

  const maxX = Math.max(...layoutNodes.map(n => n.x)) + NODE_W + 60;
  const maxY = Math.max(...layoutNodes.map(n => n.y)) + NODE_H + 60;

  return { nodes: layoutNodes, edges, width: Math.max(maxX, 600), height: Math.max(maxY, 400) };
}

// ── SVG Arrow (directional edge) ──────────────────────────────────────────

function EdgeArrow({ edge, srcNode, tgtNode, selected, onClick }) {
  if (!srcNode || !tgtNode) return null;

  const sx = srcNode.x + NODE_W;
  const sy = srcNode.y + NODE_H / 2;
  const ex = tgtNode.x;
  const ey = tgtNode.y + NODE_H / 2;

  // Curved path
  const dx = ex - sx;
  const c1x = sx + dx * 0.45;
  const c2x = ex - dx * 0.45;
  const d = `M${sx},${sy} C${c1x},${sy} ${c2x},${ey} ${ex},${ey}`;

  const color = EDGE_TYPE_COLORS[edge.relationship] || '#57606a';
  const isHighlight = selected;

  // Arrow head midpoint (end of path) for label
  const lx = (sx + ex) / 2;
  const ly = (sy + ey) / 2;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={isHighlight ? 2.5 : edge.cross_file ? 2 : 1.5}
        strokeDasharray={edge.cross_file ? '5,3' : 'none'}
        strokeOpacity={isHighlight ? 1 : 0.65}
        markerEnd={`url(#arrow-${edge.relationship?.replace(/[^a-zA-Z]/g, '') || 'default'})`}
      />
      {/* Hover wider hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
      {/* Relationship label on hover / selected */}
      {isHighlight && (
        <text x={lx} y={ly - 5} textAnchor="middle" fontSize="9" fill={color} style={{ pointerEvents: 'none', fontFamily: 'monospace' }}>
          {edge.relationship}
        </text>
      )}
    </g>
  );
}

// ── SVG Node ──────────────────────────────────────────────────────────────

function NodeBox({ node, selected, onClick, onDragStart, highCoupling }) {
  const style = NODE_TYPE_STYLES[node.type] || NODE_TYPE_STYLES.routine;
  const isHighCoupling = highCoupling && node.degree >= highCoupling;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onClick={onClick}
      onMouseDown={onDragStart}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {/* Glow for high-coupling nodes */}
      {isHighCoupling && (
        <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={9} fill="none" stroke="#d29922" strokeWidth={2} strokeDasharray="4,2" opacity={0.7} />
      )}
      {/* Node body */}
      <rect
        width={NODE_W} height={NODE_H} rx={7}
        fill={selected ? style.border + '33' : style.bg}
        stroke={selected ? style.border : style.border + '99'}
        strokeWidth={selected ? 2 : 1.5}
      />
      {/* Type badge */}
      <rect x={8} y={8} width={30} height={12} rx={3}
        fill={style.border + '22'} stroke={style.border + '55'} strokeWidth={0.5}
      />
      <text x={23} y={17.5} textAnchor="middle" fontSize="7.5" fill={style.border}
        style={{ fontFamily: 'monospace', fontWeight: 600 }}>
        {style.label}
      </text>
      {/* Label */}
      <text x={NODE_W / 2} y={NODE_H - 12} textAnchor="middle" fontSize="10" fill={style.text}
        style={{ fontFamily: 'monospace', fontWeight: 500 }}>
        {node.label?.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
      </text>
      {/* Degree indicator */}
      {node.degree > 0 && (
        <text x={NODE_W - 8} y={12} textAnchor="end" fontSize="8" fill={style.border + 'aa'}
          style={{ fontFamily: 'monospace' }}>
          ×{node.degree}
        </text>
      )}
      {/* High-coupling warning dot */}
      {isHighCoupling && (
        <circle cx={NODE_W - 7} cy={NODE_H - 7} r={4} fill="#d29922" />
      )}
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DependencyGraphPanel({
  dependencyData,
  activeRoutine,
  onProceedToConversion,
  analysisComplete,
  isAnalyzing,
  onRunAnalysis,
}) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [layout, setLayout] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // Compute layout from data
  useEffect(() => {
    if (!dependencyData?.nodes) { setLayout(null); return; }
    setLayout(computeLayout(dependencyData.nodes, dependencyData.edges || []));
  }, [dependencyData]);

  // High coupling threshold: top 20% by degree
  const highCouplingThreshold = layout
    ? (() => {
        const sorted = [...layout.nodes].sort((a, b) => b.degree - a.degree);
        return sorted.length > 3 ? sorted[Math.floor(sorted.length * 0.2)].degree : Infinity;
      })()
    : Infinity;

  // Filter nodes by search / type
  const visibleNodes = layout
    ? layout.nodes.filter(n => {
        const matchesSearch = !searchQuery || n.label?.toLowerCase().includes(searchQuery.toLowerCase()) || n.id?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === 'all' || n.type === filter;
        return matchesSearch && matchesFilter;
      })
    : [];
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = layout
    ? layout.edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
    : [];

  const nodeMap = layout ? new Map(layout.nodes.map(n => [n.id, n])) : new Map();

  // Unique relationship types for legend
  const relTypes = [...new Set((layout?.edges || []).map(e => e.relationship))].filter(Boolean);

  // Unique node types for filter buttons
  const nodeTypes = ['all', ...new Set((layout?.nodes || []).map(n => n.type))];

  // ── Zoom helpers
  const zoomIn = () => setZoom(z => Math.min(z + 0.2, 3));
  const zoomOut = () => setZoom(z => Math.max(z - 0.2, 0.3));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Pan handlers
  const onSvgMouseDown = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
      panStart.current = { sx: e.clientX - pan.x, sy: e.clientY - pan.y };
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  }, [pan]);

  const onSvgMouseMove = useCallback((e) => {
    if (isPanning && panStart.current) {
      setPan({ x: e.clientX - panStart.current.sx, y: e.clientY - panStart.current.sy });
    }
    if (draggedNode !== null && layout) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const nx = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.dx;
        const ny = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.dy;
        setLayout(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.id === draggedNode ? { ...n, x: nx, y: ny } : n)
        }));
      }
    }
  }, [isPanning, draggedNode, zoom, pan]);

  const onSvgMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
    setDraggedNode(null);
  }, []);

  const onNodeDragStart = useCallback((e, node) => {
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        dx: (e.clientX - rect.left - pan.x) / zoom - node.x,
        dy: (e.clientY - rect.top - pan.y) / zoom - node.y,
      };
    }
    setDraggedNode(node.id);
  }, [zoom, pan]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom(z => Math.max(0.3, Math.min(3, z + delta)));
  }, []);

  // Attach wheel listener with passive: false so we can prevent default
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ── Stats
  const totalNodes = layout?.nodes.length || 0;
  const totalEdges = layout?.edges.length || 0;
  const crossFileEdges = (layout?.edges || []).filter(e => e.cross_file).length;
  const highCouplingNodes = visibleNodes.filter(n => n.degree >= highCouplingThreshold && isFinite(highCouplingThreshold)).length;

  // ── Selected node detail
  const selectedNodeData = selectedNode ? nodeMap.get(selectedNode) : null;
  const selectedEdgeData = selectedEdge ? (layout?.edges[selectedEdge]) : null;
  const connectedEdges = selectedNode
    ? (layout?.edges || []).filter(e => e.source === selectedNode || e.target === selectedNode)
    : [];

  // ── Arrow marker defs
  const markerTypes = [...new Set(['default', ...relTypes.map(r => r.replace(/[^a-zA-Z]/g, ''))])];

  // ── Empty / loading / gate states ───────────────────────────────────────

  if (!activeRoutine) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <Network size={26} className="text-gh-textSubtle opacity-30" />
        <p className="text-xs text-gh-textSubtle">Select a routine to visualise its dependency graph</p>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#388bfd" strokeWidth="2" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <div className="text-center">
          <p className="text-sm font-semibold text-gh-text">Analyzing Dependencies…</p>
          <p className="text-xs text-gh-textMuted mt-1">Building dependency graph before conversion</p>
        </div>
      </div>
    );
  }

  if (!analysisComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gh-accentEmphasis/10 border border-gh-accent/20 flex items-center justify-center">
          <Network size={26} className="text-gh-accent" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gh-text">Dependency Analysis Required</h3>
          <p className="text-xs text-gh-textMuted mt-1.5 max-w-xs leading-relaxed">
            Before conversion, the dependency graph must be built to visualize functions,
            global variables, and call relationships.
          </p>
        </div>

        {/* Flow indicator */}
        <div className="flex items-center gap-2 text-[11px] font-medium">
          {['Analyze', 'Dependency Graph', 'Business Logic Map', 'Convert'].map((step, i, arr) => (
            <React.Fragment key={step}>
              <div className={`px-2.5 py-1 rounded-lg border text-[10px] ${
                i === 1
                  ? 'bg-gh-accentEmphasis/15 border-gh-accent text-gh-accent font-semibold'
                  : 'bg-gh-surface border-gh-border text-gh-textSubtle'
              }`}>
                {step}
              </div>
              {i < arr.length - 1 && <ArrowRight size={12} className="text-gh-textSubtle" />}
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={onRunAnalysis}
          className="flex items-center gap-2 px-5 py-2.5 bg-gh-accent hover:bg-gh-accentHover text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
        >
          <Play size={14} fill="currentColor" />
          Analyze Dependencies
        </button>
        <p className="text-[10px] text-gh-textSubtle italic">Conversion will be unlocked after analysis completes</p>
      </div>
    );
  }

  if (!layout || !totalNodes) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <Network size={22} className="text-gh-textSubtle opacity-40" />
        <p className="text-xs text-gh-textSubtle">No dependency data. Run pipeline to build graph.</p>
        {onRunAnalysis && (
          <button onClick={onRunAnalysis} className="text-xs px-3 py-1.5 bg-gh-accent text-white rounded-lg flex items-center gap-1.5 transition-colors">
            <Play size={10} fill="currentColor" /> Run Analysis
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gh-bg select-none">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gh-border bg-gh-canvas shrink-0 flex-wrap">
        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-gh-textSubtle">
          <span>Nodes: <strong className="text-gh-text">{totalNodes}</strong></span>
          <span>Edges: <strong className="text-gh-text">{totalEdges}</strong></span>
          {crossFileEdges > 0 && (
            <span className="text-gh-accent">Cross-file: <strong>{crossFileEdges}</strong></span>
          )}
          {highCouplingNodes > 0 && (
            <span className="text-gh-yellow flex items-center gap-1">
              <AlertTriangle size={9} /> High coupling: <strong>{highCouplingNodes}</strong>
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-gh-border mx-1" />

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-gh-bg border border-gh-border rounded-lg px-2 py-0.5">
          <Search size={10} className="text-gh-textSubtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes…"
            className="w-28 text-[10px] bg-transparent text-gh-text placeholder:text-gh-textSubtle focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gh-textSubtle hover:text-gh-text">
              <X size={9} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {nodeTypes.slice(0, 6).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                filter === t
                  ? 'bg-gh-accent border-gh-accent text-white'
                  : 'bg-gh-bg border-gh-border text-gh-textSubtle hover:text-gh-textMuted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Zoom controls */}
          <button onClick={zoomOut} title="Zoom out" className="w-6 h-6 rounded border border-gh-border bg-gh-surface hover:bg-gh-surface2 flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors">
            <ZoomOut size={10} />
          </button>
          <span className="text-[10px] text-gh-textSubtle w-8 text-center font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} title="Zoom in" className="w-6 h-6 rounded border border-gh-border bg-gh-surface hover:bg-gh-surface2 flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors">
            <ZoomIn size={10} />
          </button>
          <button onClick={resetView} title="Reset view" className="w-6 h-6 rounded border border-gh-border bg-gh-surface hover:bg-gh-surface2 flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors">
            <Maximize2 size={10} />
          </button>
          {onRunAnalysis && (
            <button onClick={onRunAnalysis} title="Re-analyze" className="w-6 h-6 rounded border border-gh-border bg-gh-surface hover:bg-gh-surface2 flex items-center justify-center text-gh-textMuted hover:text-gh-text transition-colors">
              <RefreshCw size={10} />
            </button>
          )}
        </div>
      </div>

      {/* ── Main graph + sidebar ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* SVG canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={onSvgMouseUp}
          >
            {/* Arrow markers */}
            <defs>
              {Object.entries(EDGE_TYPE_COLORS).map(([rel, color]) => (
                <marker key={rel} id={`arrow-${rel.replace(/[^a-zA-Z]/g, '')}`}
                  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill={color} />
                </marker>
              ))}
              <marker id="arrow-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#57606a" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {visibleEdges.map((edge, i) => (
                <EdgeArrow
                  key={i}
                  edge={edge}
                  srcNode={nodeMap.get(edge.source)}
                  tgtNode={nodeMap.get(edge.target)}
                  selected={selectedEdge === i || selectedNode === edge.source || selectedNode === edge.target}
                  onClick={() => { setSelectedEdge(i); setSelectedNode(null); }}
                />
              ))}

              {/* Nodes */}
              {visibleNodes.map((node) => (
                <NodeBox
                  key={node.id}
                  node={node}
                  selected={selectedNode === node.id}
                  highCoupling={highCouplingThreshold}
                  onClick={() => { setSelectedNode(node.id); setSelectedEdge(null); }}
                  onDragStart={(e) => onNodeDragStart(e, node)}
                />
              ))}
            </g>
          </svg>

          {/* Legend overlay (bottom-left) */}
          <div className="absolute bottom-3 left-3 flex flex-col gap-1 pointer-events-none">
            {relTypes.slice(0, 6).map(rel => (
              <div key={rel} className="flex items-center gap-1.5 text-[9px] text-gh-textSubtle font-mono">
                <div className="w-8 h-px" style={{ background: EDGE_TYPE_COLORS[rel] || '#57606a' }} />
                {rel}
              </div>
            ))}
            {highCouplingNodes > 0 && (
              <div className="flex items-center gap-1.5 text-[9px] text-gh-yellow font-mono">
                <div className="w-2.5 h-2.5 rounded-full bg-gh-yellow" />
                High Coupling
              </div>
            )}
          </div>
        </div>

        {/* ── Side Info Panel ── */}
        {(selectedNodeData || selectedEdgeData) && (
          <div className="w-52 border-l border-gh-border bg-gh-canvas flex flex-col shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gh-border">
              <span className="text-[10px] font-semibold text-gh-textMuted uppercase tracking-wide">
                {selectedNodeData ? 'Node Detail' : 'Edge Detail'}
              </span>
              <button onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
                className="w-4 h-4 rounded flex items-center justify-center text-gh-textSubtle hover:text-gh-text hover:bg-gh-surface transition-colors">
                <X size={10} />
              </button>
            </div>

            <div className="p-3 flex flex-col gap-3 text-[11px]">
              {selectedNodeData && (
                <>
                  <div className="p-2 bg-gh-surface border border-gh-border rounded-lg">
                    <p className="font-mono font-semibold text-xs text-gh-text mb-0.5">{selectedNodeData.label}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded border"
                        style={{
                          background: (NODE_TYPE_STYLES[selectedNodeData.type]?.border || '#388bfd') + '20',
                          color: NODE_TYPE_STYLES[selectedNodeData.type]?.text || '#79c0ff',
                          borderColor: (NODE_TYPE_STYLES[selectedNodeData.type]?.border || '#388bfd') + '50',
                        }}>
                        {selectedNodeData.type}
                      </span>
                      <span className="text-gh-textSubtle text-[9px]">degree: {selectedNodeData.degree}</span>
                    </div>
                    {selectedNodeData.routine && (
                      <p className="text-[10px] text-gh-textSubtle mt-1 font-mono">in: {selectedNodeData.routine}</p>
                    )}
                    {selectedNodeData.degree >= highCouplingThreshold && isFinite(highCouplingThreshold) && (
                      <div className="mt-1.5 flex items-center gap-1 text-[9px] text-gh-yellow">
                        <AlertTriangle size={9} /> High coupling warning
                      </div>
                    )}
                  </div>

                  {connectedEdges.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gh-textSubtle mb-1.5 uppercase tracking-wide">Connections ({connectedEdges.length})</p>
                      <div className="flex flex-col gap-1">
                        {connectedEdges.slice(0, 8).map((e, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono">
                            <span className={`text-[8px] px-1 py-0.5 rounded font-bold`}
                              style={{ color: EDGE_TYPE_COLORS[e.relationship] || '#57606a', background: (EDGE_TYPE_COLORS[e.relationship] || '#57606a') + '20' }}>
                              {e.relationship}
                            </span>
                            <span className="text-gh-textSubtle truncate">
                              {e.source === selectedNode ? `→ ${e.target}` : `← ${e.source}`}
                            </span>
                          </div>
                        ))}
                        {connectedEdges.length > 8 && (
                          <p className="text-[9px] text-gh-textSubtle">+{connectedEdges.length - 8} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedEdgeData && (
                <div className="p-2 bg-gh-surface border border-gh-border rounded-lg">
                  <p className="font-mono text-[10px] font-semibold"
                    style={{ color: EDGE_TYPE_COLORS[selectedEdgeData.relationship] || '#57606a' }}>
                    {selectedEdgeData.relationship}
                  </p>
                  <p className="text-gh-textMuted mt-1 text-[10px]">
                    <span className="text-gh-accent">{selectedEdgeData.source}</span>
                    <span className="text-gh-textSubtle mx-1">→</span>
                    <span className="text-gh-green">{selectedEdgeData.target}</span>
                  </p>
                  {selectedEdgeData.cross_file && (
                    <p className="text-[9px] text-gh-accent mt-1 flex items-center gap-1">
                      <Info size={9} /> Cross-file dependency
                    </p>
                  )}
                  {selectedEdgeData.confidence !== undefined && (
                    <p className="text-[9px] text-gh-textSubtle mt-0.5">confidence: {Math.round(selectedEdgeData.confidence * 100)}%</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Proceed to Conversion Gate ── */}
      {analysisComplete && onProceedToConversion && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gh-border bg-gh-canvas shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-gh-textMuted">
            <CheckCircle size={12} className="text-gh-green" />
            <span>Dependency analysis complete</span>
            {crossFileEdges > 0 && (
              <span className="text-gh-accent">· {crossFileEdges} cross-file dependencies detected</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {highCouplingNodes > 0 && (
              <span className="text-[10px] text-gh-yellow flex items-center gap-1">
                <AlertTriangle size={10} /> {highCouplingNodes} high-coupling node{highCouplingNodes > 1 ? 's' : ''} — review before conversion
              </span>
            )}
            <button
              onClick={onProceedToConversion}
              className="flex items-center gap-2 px-4 py-1.5 bg-gh-accent hover:bg-gh-accentHover text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
            >
              <Play size={11} fill="currentColor" />
              Proceed to Conversion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
