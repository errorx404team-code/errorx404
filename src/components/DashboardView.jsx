import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { LayoutDashboard, ShieldCheck, FileCheck, Activity, Layers, RefreshCw, TrendingUp } from 'lucide-react';

export default function DashboardView() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/summary');
      if (res.ok) setSummary(await res.json());
    } catch (e) {
      console.error('Dashboard fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gh-bg gap-3 text-gh-textSubtle">
        <RefreshCw size={18} className="animate-spin text-gh-accent" />
        <span className="text-sm">Loading dashboard…</span>
      </div>
    );
  }

  const pieData = [
    { name: 'Safe ≥85%', value: summary?.status_breakdown?.safe || 0, color: '#3fb950' },
    { name: 'Needs Review', value: summary?.status_breakdown?.needs_review || 0, color: '#d29922' },
    { name: 'Failed <50%', value: summary?.status_breakdown?.failed || 0, color: '#f85149' },
  ];

  const reviewPieData = [
    { name: 'Approved', value: summary?.approved_reviews || 0, color: '#3fb950' },
    { name: 'Rejected', value: summary?.rejected_reviews || 0, color: '#f85149' },
    { name: 'Changes Req.', value: summary?.changes_requested_reviews || 0, color: '#d29922' },
    { name: 'Pending Review', value: summary?.pending_reviews || 0, color: '#6e7681' },
  ];

  const barData = summary?.quality_metrics || [
    { name: 'Avg Quality', confidence: summary?.avg_confidence_score || 90.0, cohesion: summary?.avg_partition_cohesion || 85.0 },
  ];

  const qualityKpis = [
    {
      label: 'Total Routines',
      value: summary?.total_routines || 0,
      icon: FileCheck,
      color: 'text-gh-accent',
      bg: 'bg-gh-accentEmphasis/10 border-gh-accent/20',
    },
    {
      label: 'Avg Confidence',
      value: `${summary?.avg_confidence_score || 0}%`,
      icon: ShieldCheck,
      color: 'text-gh-green',
      bg: 'bg-gh-greenBg border-gh-greenDim/30',
    },
    {
      label: 'Logic Cohesion',
      value: `${summary?.avg_partition_cohesion || 0}%`,
      icon: Layers,
      color: 'text-gh-purple',
      bg: 'bg-gh-purpleBg border-gh-purple/20',
    },
    {
      label: 'Business Logic Coverage',
      value: `${summary?.business_logic_coverage_pct || 100}%`,
      icon: TrendingUp,
      color: 'text-gh-orange',
      bg: 'bg-orange-400/10 border-orange-400/20',
    },
  ];

  const reviewKpis = [
    {
      label: 'Total Reviews',
      value: summary?.total_reviews || 0,
      icon: Activity,
      color: 'text-gh-accent',
      bg: 'bg-gh-surface border-gh-border',
    },
    {
      label: 'Approved',
      value: summary?.approved_reviews || 0,
      icon: ShieldCheck,
      color: 'text-gh-green',
      bg: 'bg-gh-greenBg border-gh-greenDim/30',
    },
    {
      label: 'Rejected',
      value: summary?.rejected_reviews || 0,
      icon: FileCheck,
      color: 'text-gh-red',
      bg: 'bg-gh-redBg border-gh-red/20',
    },
    {
      label: 'Pending Review',
      value: summary?.pending_reviews ?? (summary?.total_conversions || 0),
      icon: Layers,
      color: 'text-gh-yellow',
      bg: 'bg-gh-yellowBg border-gh-yellow/30',
    },
    {
      label: 'Approval Rate',
      value: `${summary?.approval_rate ?? 100}%`,
      icon: TrendingUp,
      color: 'text-gh-green',
      bg: 'bg-gh-greenBg border-gh-greenDim/30',
    },
  ];

  const projectKpis = [
    {
      label: 'Verified Projects',
      value: summary?.verified_projects || 0,
      icon: ShieldCheck,
      color: 'text-gh-green',
      bg: 'bg-gh-greenBg border-gh-greenDim/30',
    },
    {
      label: 'Failed Projects',
      value: summary?.failed_projects || 0,
      icon: FileCheck,
      color: 'text-gh-red',
      bg: 'bg-gh-redBg border-gh-red/20',
    },
    {
      label: 'Projects Pending Review',
      value: summary?.projects_pending_review || 0,
      icon: Layers,
      color: 'text-gh-yellow',
      bg: 'bg-gh-yellowBg border-gh-yellow/30',
    },
  ];

  const tooltipStyle = {
    backgroundColor: '#161b22',
    borderColor: '#30363d',
    borderRadius: '8px',
    color: '#e6edf3',
    fontSize: '12px',
  };

  return (
    <div className="flex-1 bg-gh-bg overflow-y-auto animate-fadeIn">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-lg font-bold text-gh-text flex items-center gap-2">
              <LayoutDashboard size={20} className="text-gh-accent" />
              Migration &amp; Project Health Dashboard
            </h1>
            <p className="text-xs text-gh-textSubtle mt-1">
              Real-time analytics, Project Verification status, and Human-in-the-Loop audit metrics from ErrorX404
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-3 py-1.5 bg-gh-surface hover:bg-gh-surface2 border border-gh-border text-gh-textMuted hover:text-gh-text rounded-lg text-xs transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Project Verification KPIs (Requirement 9) */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gh-textMuted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-gh-accent" />
            Project Verification Readiness
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {projectKpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className={`p-3.5 rounded-xl border ${kpi.bg} flex items-center justify-between hover-lift`}>
                  <div>
                    <p className="text-[11px] text-gh-textMuted font-medium">{kpi.label}</p>
                    <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <Icon size={22} className={`${kpi.color} opacity-70`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Human Review KPIs (Requirement 7) */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gh-textMuted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity size={14} className="text-gh-green" />
            Human-in-the-Loop Review Audit KPIs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {reviewKpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className={`p-3.5 rounded-xl border ${kpi.bg} flex items-center justify-between hover-lift`}>
                  <div>
                    <p className="text-[11px] text-gh-textMuted font-medium">{kpi.label}</p>
                    <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <Icon size={22} className={`${kpi.color} opacity-70`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline Quality KPI Grid */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gh-textMuted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity size={14} className="text-gh-accent" />
            Transformation Quality &amp; Cohesion
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {qualityKpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className={`p-4 rounded-xl border ${kpi.bg} flex items-center justify-between hover-lift`}>
                  <div>
                    <p className="text-xs text-gh-textMuted font-medium">{kpi.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <Icon size={26} className={`${kpi.color} opacity-70`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Bar Chart */}
          <div className="p-5 bg-gh-canvas border border-gh-border rounded-xl">
            <h3 className="text-sm font-semibold text-gh-text mb-4">Modernization Quality Metrics</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
                  <XAxis dataKey="name" stroke="#6e7681" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6e7681" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'rgba(56,139,253,0.05)' }}
                  />
                  <Bar dataKey="confidence" name="Confidence %" fill="#388bfd" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cohesion" name="Cohesion %" fill="#3fb950" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Status & Review Distribution */}
          <div className="p-5 bg-gh-canvas border border-gh-border rounded-xl">
            <h3 className="text-sm font-semibold text-gh-text mb-4">Confidence Status Distribution</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="48%"
                    innerRadius={52} outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    formatter={(value) => <span style={{ color: '#8b949e', fontSize: '11px' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-5 p-4 bg-gh-canvas border border-gh-border rounded-xl flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gh-green" />
            <span className="text-xs text-gh-textMuted">Total Conversions: <strong className="text-gh-text">{summary?.total_conversions || 0}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gh-accent" />
            <span className="text-xs text-gh-textMuted">Approved Conversions: <strong className="text-gh-green">{summary?.approved_reviews || 0}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gh-purple" />
            <span className="text-xs text-gh-textMuted">Approval Rate: <strong className="text-gh-green">{summary?.approval_rate ?? 100}%</strong></span>
          </div>
          <div className="ml-auto text-[10px] text-gh-textSubtle italic">
            SQL Aggregated · Audit Trail Active
          </div>
        </div>
      </div>
    </div>
  );
}
