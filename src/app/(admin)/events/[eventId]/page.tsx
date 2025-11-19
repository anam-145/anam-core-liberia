import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import ClientPage from './ClientPage';

export default async function EventDetailPage({ params }: { params: { eventId: string } }) {
  const ok = await hasRole(AdminRole.SYSTEM_ADMIN);
  if (!ok) redirect('/denied');
  return <ClientPage params={params} />;
}
