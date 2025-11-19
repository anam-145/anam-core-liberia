import { apiError, apiOk } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { ensureDataSource } from '@/server/db/ensureDataSource';
import { AppDataSource } from '@/server/db/datasource';
import { EventStaff, EventRole } from '@/server/db/entities/EventStaff';
import { Event } from '@/server/db/entities/Event';
import { In } from 'typeorm';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await ensureDataSource();
    const session = await getSession();
    if (!session.isLoggedIn) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    // Query parameter로 role 필터링 (기본값: 모든 역할)
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');
    const filterRole =
      roleParam === 'APPROVER' ? EventRole.APPROVER : roleParam === 'VERIFIER' ? EventRole.VERIFIER : null;

    const repo = AppDataSource.getRepository(EventStaff);
    const rows = await repo.find({
      where: filterRole
        ? {
            adminId: session.adminId,
            eventRole: filterRole,
          }
        : {
            adminId: session.adminId,
          },
    });
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
