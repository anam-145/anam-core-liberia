import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CheckinsClient from './CheckinsClient';

// Access: All logged-in users (SYSTEM_ADMIN + STAFF)
export default async function CheckinsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/denied');

  return <CheckinsClient />;
}
