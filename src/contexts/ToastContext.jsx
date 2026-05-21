import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

const COLORS = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', text: '#15803d' },
  error:   { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', text: '#b91c1c' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', text: '#92400e' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1d4ed8' },
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info;
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: c.bg, border: `1px solid ${c.border}`,
                borderLeft: `4px solid ${c.icon}`,
                borderRadius: 12, padding: '14px 16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: 280, maxWidth: 380,
                cursor: 'pointer', pointerEvents: 'all',
                transform: t.exiting ? 'translateX(120%)' : 'translateX(0)',
                opacity: t.exiting ? 0 : 1,
                transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
                animation: t.exiting ? 'none' : 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <span style={{ color: c.icon, flexShrink: 0, marginTop: 1 }}>{ICONS[t.type]}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: c.text, lineHeight: 1.5 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toastIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
}
