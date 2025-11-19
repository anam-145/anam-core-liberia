'use client';

import React from 'react';

interface ProgressModalProps {
  open: boolean;
  title?: string;
  message?: string;
  done?: boolean; // when true, show success UI with confirm button
  confirmText?: string;
  onConfirm?: () => void;
}

export default function ProgressModal({
  open,
  title,
  message,
  done = false,
  confirmText = 'Confirm',
  onConfirm,
}: ProgressModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title || 'Processing'}</div>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>{message || 'Please wait...'}</div>
        {!done ? (
          <div style={{ height: 54, display: 'grid', placeItems: 'center' }}>
            <Bouncer />
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--primary" onClick={onConfirm} aria-label={confirmText}>
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Bouncer() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      {[0, 1, 2].map((i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: '#1976d2',
            display: 'inline-block',
            animation: `anm-bounce 0.9s ${i * 0.12}s infinite ease-in-out`,
          }}
        />
      ))}
      <style>{`
        @keyframes anm-bounce {
          0% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-8px); opacity: 1; }
          60% { transform: translateY(0); opacity: 0.7; }
          100% { transform: translateY(0); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
