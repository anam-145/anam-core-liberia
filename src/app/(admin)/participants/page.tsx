import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import ParticipantsRegisterClient from './ParticipantsRegisterClient';

export default async function ParticipantsPage() {
  const ok = await hasRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (!ok) redirect('/denied');
  return <ParticipantsRegisterClient />;
}
