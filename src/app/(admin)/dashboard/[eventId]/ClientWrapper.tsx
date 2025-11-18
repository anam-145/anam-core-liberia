'use client';

import { useRouter } from 'next/navigation';
import EventDetailClient from '@/app/(admin)/events/[eventId]/EventDetailClient';

export default function DashboardEventDetailClientWrapper({ eventId }: { eventId: string }) {
  const router = useRouter();
  return (
    <EventDetailClient
      eventId={eventId}
      onBack={() => {
        router.push('/dashboard');
      }}
    />
  );
}
