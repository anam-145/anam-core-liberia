import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  const ok = await hasRole(AdminRole.SYSTEM_ADMIN);
  if (!ok) redirect('/denied');
  return <UsersClient />;
}
