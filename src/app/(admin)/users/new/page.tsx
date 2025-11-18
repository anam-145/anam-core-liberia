import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import UserRegisterClient from './UserRegisterClient';

export default async function UserNewPage() {
  const ok = await hasRole([AdminRole.SYSTEM_ADMIN, AdminRole.STAFF]);
  if (!ok) redirect('/denied');
  return <UserRegisterClient />;
}
