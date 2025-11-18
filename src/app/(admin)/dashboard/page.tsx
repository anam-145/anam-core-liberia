import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

// Access: All logged-in users (빈 목록이어도 접근 가능)
export default async function DashboardPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/denied');

  return <DashboardClient />;
}
