import AccessDenied from '@/components/ui/AccessDenied';

export default function DeniedPage() {
  return (
    <div className="min-h-[80dvh] grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <AccessDenied message="You do not have permission to access this page." />
      </div>
    </div>
  );
}
