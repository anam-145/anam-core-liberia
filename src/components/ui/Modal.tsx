'use client';
import React from 'react';
import Button from './Button';

export default function Modal({
  title,
  trigger,
  children,
}: {
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)} style={{ display: 'inline-block' }}>
        {trigger}
      </span>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,17,21,.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
          }}
          onClick={() => setOpen(false)}
        >
          <div className="card" style={{ width: 520, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div
              className="card__header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>{title}</div>
              <button className="btn btn--ghost" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <div className="card__body">{children}</div>
            <div className="card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button>저장</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
