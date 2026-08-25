import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: {
      bg: 'bg-gh-canvas border-gh-green/40',
      icon: <CheckCircle2 size={15} className="text-gh-green shrink-0" />,
      text: 'text-gh-green',
    },
    error: {
      bg: 'bg-gh-canvas border-gh-red/40',
      icon: <AlertCircle size={15} className="text-gh-red shrink-0" />,
      text: 'text-gh-red',
    },
    info: {
      bg: 'bg-gh-canvas border-gh-accent/40',
      icon: <Info size={15} className="text-gh-accent shrink-0" />,
      text: 'text-gh-text',
    },
  };

  const s = styles[type] || styles.info;

  return (
    <div className={`animate-slideInUp flex items-center gap-3 px-4 py-3 rounded-xl border shadow-modal text-xs font-medium ${s.bg} max-w-sm`}>
      {s.icon}
      <span className={`flex-1 ${s.text}`}>{message}</span>
      <button
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-gh-surface text-gh-textSubtle hover:text-gh-text transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}
