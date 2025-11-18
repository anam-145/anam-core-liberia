import { apiError, apiOk } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { ensureDataSource } from '@/server/db/ensureDataSource';
import { AppDataSource } from '@/server/db/datasource';
import { EventStaff } from '@/server/db/entities/EventStaff';
import { Event } from '@/server/db/entities/Event';
import { In } from 'typeorm';

export async function GET() {
  try {
    await ensureDataSource();
    const session = await getSession();
    if (!session.isLoggedIn) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const repo = AppDataSource.getRepository(EventStaff);
    const rows = await repo.find({ where: { adminId: session.adminId } });
    const assignedEventIds = Array.from(new Set(rows.map((r) => r.eventId)));

    // If no assignments, return empty summary
    if (assignedEventIds.length === 0) {
      return apiOk({ assignedEventIds, events: [], total: 0 });
    }

    // Fetch event summaries for assigned events
    const eventRepo = AppDataSource.getRepository(Event);
    const events = await eventRepo.find({
      where: { eventId: In(assignedEventIds) },
      order: { startDate: 'DESC' },
    });

    // Add derivedStatus like the admin list API for UI parity
    const now = new Date();
    const withDerived = events.map((e) => {
      const start = new Date(e.startDate as unknown as string);
      const end = new Date(e.endDate as unknown as string);
      const derivedStatus = now < start ? 'PENDING' : now > end ? 'COMPLETED' : 'ONGOING';
      return { ...e, derivedStatus } as unknown as Record<string, unknown>;
    });

    return apiOk({ assignedEventIds, events: withDerived, total: withDerived.length });
  } catch (error) {
    console.error('Error in GET /api/admin/events/staff/me:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
