import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import EventsClient from './EventsClient';

export default async function EventsPage() {
  const ok = await hasRole(AdminRole.SYSTEM_ADMIN);
  if (!ok) redirect('/denied');
  return <EventsClient />;
}
