import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { randomUUID } from 'crypto';
import { createEventOnChain } from '@/services/event-factory.service';

/**
 * POST /api/admin/events
 * Create a new event (SYSTEM_ADMIN only)
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();

    // Validate required fields (token is fixed to USDC via env; no token fields in body)
    if (!body.name || !body.startDate || !body.endDate || !body.amountPerDay) {
      return apiError('Missing required fields: name, startDate, endDate, amountPerDay', 400, 'VALIDATION_ERROR');
    }

    // Additional domain validations
    // 1) Event name length >= 2
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return apiError('Event name must be at least 2 characters', 400, 'VALIDATION_ERROR', {
        field: 'name',
      });
    }

    // 2) Dates: only future events, must start from tomorrow (not today), and end >= start
    const toDateOnly = (d: string | Date) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt;
    };
    const startDateOnly = toDateOnly(body.startDate);
    const endDateOnly = toDateOnly(body.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (startDateOnly < tomorrow) {
      return apiError('Start date must be from tomorrow (future only)', 400, 'VALIDATION_ERROR', {
        field: 'startDate',
      });
    }
    if (endDateOnly < startDateOnly) {
      return apiError('End date must be same as or after start date', 400, 'VALIDATION_ERROR', {
        field: 'endDate',
      });
    }

    // 3) Amount / participants constraints (temporary hard caps; TODO: fetch from contract)
    const MAX_AMOUNT_PER_DAY_USDC = 1000; // TODO: Replace with contract limit
    const MAX_PARTICIPANTS = 10000; // TODO: Replace with contract limit

    const amount = Number(body.amountPerDay);
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError('Amount per day must be a positive number', 400, 'VALIDATION_ERROR', {
        field: 'amountPerDay',
      });
    }
    if (amount > MAX_AMOUNT_PER_DAY_USDC) {
      return apiError(
        `Amount per day exceeds temporary limit (${MAX_AMOUNT_PER_DAY_USDC} USDC)`,
        400,
        'VALIDATION_ERROR',
        {
          field: 'amountPerDay',
        },
      );
    }
    // normalize to 6 decimals (DB uses decimal(12,6))
    const normalizedAmount = amount.toFixed(6);

    let maxParticipants: number | undefined = undefined;
    if (body.maxParticipants !== undefined && body.maxParticipants !== null && body.maxParticipants !== '') {
      const n = Number(body.maxParticipants);
      if (!Number.isInteger(n) || n <= 0) {
        return apiError('Max participants must be a positive integer', 400, 'VALIDATION_ERROR', {
          field: 'maxParticipants',
        });
      }
      if (n > MAX_PARTICIPANTS) {
        return apiError(`Max participants exceeds temporary limit (${MAX_PARTICIPANTS})`, 400, 'VALIDATION_ERROR', {
          field: 'maxParticipants',
        });
      }
      maxParticipants = n;
    }

    const session = await getSession();

    const event = await adminService.createEvent(
      {
        eventId: randomUUID(),
        name: body.name,
        description: body.description,
        startDate: startDateOnly,
        endDate: endDateOnly,
        amountPerDay: normalizedAmount,
        maxParticipants,
      },
      session.adminId,
    );

    // TODO: Blockchain Integration - Deploy Event Smart Contract via EventFactory
    // 1) 실제 구현 시 signer(issuer) privateKey와 factory 주소/ABI 사용
    // 2) approvers/verifiers 목록은 EventStaff(초기 배정)에서 가져와 전달
    // 3) 아래 스텁 호출은 고정 address/txHash를 반환 (임시)
    const { address, txHash } = await createEventOnChain({
      usdcAddress: process.env.BASE_USDC_ADDRESS || '0x0000000000000000000000000000000000000000',
      startTime: event.startDate,
      endTime: event.endDate,
      amountPerDay: event.amountPerDay,
      maxParticipants: event.maxParticipants,
      approvers: [],
      verifiers: [],
    });

    const updated = await adminService.updateEvent(event.id, {
      eventContractAddress: address,
      deploymentTxHash: txHash,
    });

    return apiOk({ event: updated ?? event }, 201);
  } catch (error) {
    console.error('Error in POST /api/admin/events:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return apiError(error.message, 409, 'CONFLICT');
    }
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}

/**
 * GET /api/admin/events
 * List events with pagination and filters
 */
export async function GET(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    const { searchParams } = new URL(request.url);

    // derived status from dates (PENDING/ONGOING/COMPLETED)
    const derived = (searchParams.get('derivedStatus') || searchParams.get('status') || '').toUpperCase();
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const { events, total } = await adminService.getEvents({ limit, offset });

    const now = new Date();
    const withDerived = events.map((e) => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const derivedStatus = now < start ? 'PENDING' : now > end ? 'COMPLETED' : 'ONGOING';
      return { ...e, derivedStatus } as unknown as Record<string, unknown>;
    });

    const filtered = ['PENDING', 'ONGOING', 'COMPLETED'].includes(derived)
      ? withDerived.filter((e: any) => e.derivedStatus === derived)
      : withDerived;

    return apiOk({ events: filtered, total });
  } catch (error) {
    console.error('Error in GET /api/admin/events:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
