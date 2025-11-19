import { hasRole } from '@/lib/auth';
import { AdminRole } from '@/server/db/entities/Admin';
import { redirect } from 'next/navigation';
import AdminsClient from './AdminsClient';

export default async function AdminsPage() {
  const ok = await hasRole(AdminRole.SYSTEM_ADMIN);
  if (!ok) redirect('/denied');
  return <AdminsClient />;
}
