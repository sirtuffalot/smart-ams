import React from 'react';
import { AlertCircle } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onCancel, isDanger = true }) => {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ padding: '24px 24px 16px', display: 'flex', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: isDanger ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={24} color={isDanger ? '#ef4444' : '#10b981'} />
          </div>
          <div style={{ paddingTop: 4 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8, letterSpacing: '-0.3px' }}>{title}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>
        <div style={{ padding: '16px 24px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e2e8f0' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            {cancelText}
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: isDanger ? '#ef4444' : '#10b981', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', boxShadow: isDanger ? '0 4px 12px rgba(239,68,68,0.2)' : '0 4px 12px rgba(16,185,129,0.2)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = isDanger ? '0 6px 16px rgba(239,68,68,0.3)' : '0 6px 16px rgba(16,185,129,0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDanger ? '0 4px 12px rgba(239,68,68,0.2)' : '0 4px 12px rgba(16,185,129,0.2)'; }}>
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ConfirmModal;
