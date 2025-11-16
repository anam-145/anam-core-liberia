'use client';

import Button from './Button';

interface AccessDeniedProps {
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export default function AccessDenied({
  message = '접근 권한이 없습니다.',
  actionText = '대시보드로 이동',
  onAction,
}: AccessDeniedProps) {
  return (
    <div className="card">
      <div className="card__body text-center py-16">
        <h2 className="text-xl font-bold mb-2">권한 없음</h2>
        <p className="text-[var(--muted)] mb-6">{message}</p>
        <Button variant="secondary" onClick={onAction ?? (() => (window.location.href = '/dashboard'))}>
          {actionText}
        </Button>
      </div>
    </div>
  );
}
