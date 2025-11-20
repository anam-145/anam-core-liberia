'use client';

import Button from './Button';

interface AccessDeniedProps {
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export default function AccessDenied({
  message = 'You do not have permission to access this page.',
  actionText = 'Go to dashboard',
  onAction,
}: AccessDeniedProps) {
  return (
    <div className="card">
      <div className="card__body text-center py-16">
        <h2 className="text-xl font-bold mb-2">Access denied</h2>
        <p className="text-[var(--muted)] mb-6">{message}</p>
        <Button variant="secondary" onClick={onAction ?? (() => (window.location.href = '/dashboard'))}>
          {actionText}
        </Button>
      </div>
    </div>
  );
}
