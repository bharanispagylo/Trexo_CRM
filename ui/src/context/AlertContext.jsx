import React, { createContext, useContext, useState, useCallback } from 'react';

const AlertContext = createContext(null);

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#16a34a" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#dc2626" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#d97706" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#2563eb" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const TYPE_STYLES = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7', btnBg: '#16a34a', btnHover: '#15803d' },
  error:   { bg: '#fef2f2', border: '#fecaca', iconBg: '#fee2e2', btnBg: '#dc2626', btnHover: '#b91c1c' },
  warning: { bg: '#fffbeb', border: '#fde68a', iconBg: '#fef3c7', btnBg: '#d97706', btnHover: '#b45309' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe', btnBg: '#2563eb', btnHover: '#1d4ed8' },
};

export function AlertProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const showAlert = useCallback(({ title, message, type = 'info', onConfirm, confirmText = 'OK', showCancel = false, cancelText = 'Cancel' }) => {
    const id = Date.now();
    setQueue(prev => [...prev, { id, title, message, type, onConfirm, confirmText, showCancel, cancelText }]);
  }, []);

  const closeTop = useCallback((id, confirmed = false) => {
    let itemToConfirm = null;
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (confirmed && item?.onConfirm) {
        itemToConfirm = item;
      }
      return prev.filter(i => i.id !== id);
    });
    if (itemToConfirm) {
      itemToConfirm.onConfirm();
    }
  }, []);

  // Convenience helpers
  const alert = useCallback((message, type = 'info', title) => {
    showAlert({ title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Notice'), message, type });
  }, [showAlert]);

  const confirm = useCallback((message, onConfirm, title = 'Confirm Action') => {
    showAlert({ title, message, type: 'warning', onConfirm, confirmText: 'Confirm', showCancel: true });
  }, [showAlert]);

  const current = queue[0] || null;
  const styles = current ? TYPE_STYLES[current.type] : null;

  return (
    <AlertContext.Provider value={{ alert, confirm, showAlert }}>
      {children}
      {current && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 99999, animation: 'fadeIn 0.15s ease',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeTop(current.id); }}
        >
          <div
            style={{
              background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px',
              margin: '1rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: `1px solid ${styles.border}`,
              animation: 'slideUp 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              overflow: 'hidden',
            }}
          >
            {/* Colored top strip */}
            <div style={{ height: '4px', background: styles.btnBg, width: '100%' }} />

            <div style={{ padding: '2rem' }}>
              {/* Icon + Title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '12px',
                  background: styles.iconBg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  {ICONS[current.type]}
                </div>
                <div style={{ paddingTop: '0.25rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                    {current.title}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 }}>
                    {current.message}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                {current.showCancel && (
                  <button
                    onClick={() => closeTop(current.id, false)}
                    style={{
                      padding: '0.6rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                      background: 'white', color: '#475569', fontWeight: 600, fontSize: '0.9rem',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.target.style.background = '#f8fafc'}
                    onMouseLeave={e => e.target.style.background = 'white'}
                  >
                    {current.cancelText}
                  </button>
                )}
                <button
                  onClick={() => closeTop(current.id, true)}
                  style={{
                    padding: '0.6rem 1.75rem', borderRadius: '10px', border: 'none',
                    background: styles.btnBg, color: 'white', fontWeight: 700, fontSize: '0.9rem',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.target.style.background = styles.btnHover}
                  onMouseLeave={e => e.target.style.background = styles.btnBg}
                >
                  {current.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(24px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within an AlertProvider');
  return ctx;
}
