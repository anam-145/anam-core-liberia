import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import NewEventClient from './NewEventClient';

export default async function EventNewPage() {
  const ok = await hasRole(AdminRole.SYSTEM_ADMIN);
  if (!ok) redirect('/denied');
  return <NewEventClient />;
}
