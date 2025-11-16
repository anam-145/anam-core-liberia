import AccessDenied from '@/components/ui/AccessDenied';

export default function DeniedPage() {
  return (
    <div className="min-h-[80dvh] grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <AccessDenied message="접근 권한이 없습니다." />
      </div>
    </div>
  );
}
