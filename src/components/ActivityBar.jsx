import React from 'react';
import { Files, Network, LayoutDashboard, Settings, Layers, UserCheck, PackageCheck } from 'lucide-react';
import logoImg from '../assets/temp_image_1786523047062.jpeg';

export default function ActivityBar({ activeTab, setActiveTab, onOpenSettings }) {
  const navItems = [
    { id: 'explorer', label: 'Explorer', icon: Files },
    { id: 'graph', label: 'Dependency Graph', icon: Network },
    { id: 'partition', label: 'Business Logic Map', icon: Layers },
    { id: 'project-verify', label: 'Project Verify', icon: PackageCheck },
    { id: 'review', label: 'Human View', icon: UserCheck },
    { id: 'dashboard', label: 'Migration Dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="w-12 bg-gh-canvas border-r border-gh-border flex flex-col justify-between items-center py-2 select-none z-20 shrink-0">
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg overflow-hidden mb-3 mx-auto flex items-center justify-center">
          <img src={logoImg} alt="ErrorX404" className="w-full h-full object-cover rounded-lg" />
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center transition-all relative group ${
                isActive
                  ? 'bg-gh-surface text-gh-accent'
                  : 'text-gh-textSubtle hover:text-gh-textMuted hover:bg-gh-surface/60'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2 : 1.75} />
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gh-accent rounded-r-full" />
              )}
              <span className="absolute left-full ml-2 px-2 py-1 bg-gh-surface2 border border-gh-border text-gh-text text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-panel">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1 w-full pb-1">
        <button
          onClick={onOpenSettings}
          title="API Settings"
          className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center text-gh-textSubtle hover:text-gh-textMuted hover:bg-gh-surface/60 transition-all relative group"
        >
          <Settings size={18} strokeWidth={1.75} />
          <span className="absolute left-full ml-2 px-2 py-1 bg-gh-surface2 border border-gh-border text-gh-text text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-panel">
            API Settings
          </span>
        </button>
      </div>
    </div>
  );
}
