import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ensureDataSource } from '@/server/db/ensureDataSource';
import { AppDataSource } from '@/server/db/datasource';
import { EventStaff, EventRole } from '@/server/db/entities/EventStaff';
import ClientWrapper from './ClientWrapper';

interface Props {
  params: { eventId: string };
}

export default async function DashboardEventDetailPage({ params }: Props) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect('/denied');
  }

  // SYSTEM_ADMIN은 모두 접근 가능, STAFF는 APPROVER 권한이 있는 이벤트만 접근 가능
  if (session.role !== 'SYSTEM_ADMIN') {
    await ensureDataSource();
    const repo = AppDataSource.getRepository(EventStaff);
    const approver = await repo.findOne({
      where: {
        eventId: params.eventId,
        adminId: session.adminId,
        eventRole: EventRole.APPROVER,
      },
    });
    if (!approver) {
      redirect('/denied');
    }
  }

  // 디자인만 표시하는 클라이언트 컴포넌트 렌더링
  return <ClientWrapper eventId={params.eventId} />;
}
