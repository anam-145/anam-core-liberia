import type { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireRole } from '@/lib/auth-middleware';
import { getSession } from '@/lib/auth';
import { apiOk, apiError } from '@/lib/api-response';
import { AdminRole } from '@/server/db/entities/Admin';
import { randomUUID } from 'crypto';
import { createEventOnChain } from '@/services/event-factory.service';
import { blockchainService } from '@/services/blockchain.service';
import { parseUnits } from 'ethers';

/**
 * POST /api/admin/events
 * Create a new event (SYSTEM_ADMIN only)
 */
export async function POST(request: NextRequest) {
  const authCheck = await requireRole(AdminRole.SYSTEM_ADMIN);
  if (authCheck) return authCheck;

  try {
    // 0) 입력 검증 (이벤트명/기간/일일금액/최대 참가자)
    const body = await request.json();

    // Validate required fields (token is fixed to USDC via env; no token fields in body)
    {
      const fieldErrors: Record<string, string> = {};
      if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
        fieldErrors.name = '이벤트명을 입력해 주세요.';
      }
      if (!body.startDate) {
        fieldErrors.startDate = '시작일을 선택해 주세요.';
      }
      if (!body.endDate) {
        fieldErrors.endDate = '종료일을 선택해 주세요.';
      }
      if (!body.amountPerDay) {
        fieldErrors.amountPerDay = '지급 금액을 입력해 주세요.';
      }
      if (Object.keys(fieldErrors).length > 0) {
        return apiError('Validation failed', 400, 'VALIDATION_ERROR', { fieldErrors });
      }
    }

    // 0-1) 이벤트명 최소 길이 검증
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      return apiError('Event name must be at least 2 characters', 400, 'VALIDATION_ERROR', {
        field: 'name',
      });
    }

    // 0-2) 날짜 검증: 내일부터 시작, 종료일은 시작일 이상
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

    // 0-3) 금액/참가자 수 제약 (임시 상한)
    const MAX_AMOUNT_PER_DAY_USDC = 1000;
    const MAX_PARTICIPANTS = 10000;

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
    // 0-4) 금액 정규화: 6 decimals (DB: decimal(12,6))
    const normalizedAmount = amount.toFixed(6);

    // Max participants required now (funding = amountPerDay * maxParticipants)
    if (body.maxParticipants === undefined || body.maxParticipants === null || body.maxParticipants === '') {
      return apiError('Max participants is required', 400, 'VALIDATION_ERROR', { field: 'maxParticipants' });
    }
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
    const maxParticipants = n;

    const session = await getSession();

    // 1) 컨트랙트 배포 (EventFactory) — DB 저장 전 반드시 온체인 완료
    const eventId = randomUUID();
    const { address, txHash } = await createEventOnChain({
      eventId,
      startTime: startDateOnly,
      endTime: endDateOnly,
      amountPerDay: normalizedAmount,
      maxParticipants,
      approvers: [],
      verifiers: [],
    });

    // 2) 자금 입금(USDC): amountPerDay(6d) × maxParticipants — 체인 성공 후 즉시 입금
    const tokenAddress = process.env.BASE_USDC_ADDRESS;
    if (!tokenAddress) {
      return apiError('USDC address not configured', 500, 'INTERNAL_ERROR');
    }
    const perDay = parseUnits(normalizedAmount, 6);
    const fundingAmount = perDay * BigInt(maxParticipants);

    try {
      // signer from system admin mnemonic
      const { getSystemAdminWallet } = await import('@/services/system-init.service');
      const wallet = getSystemAdminWallet();
      const fundingTxHash = await blockchainService.transferERC20(
        tokenAddress,
        address,
        fundingAmount,
        wallet.privateKey,
      );
      // 3) DB 저장: 온체인(배포/입금) 성공 이후에만 이벤트 등록
      const event = await adminService.createEvent(
        {
          eventId,
          name: body.name,
          description: body.description,
          startDate: startDateOnly,
          endDate: endDateOnly,
          amountPerDay: normalizedAmount,
          maxParticipants,
        },
        session.adminId,
      );
      const updated = await adminService.updateEvent(event.id, {
        eventContractAddress: address,
        deploymentTxHash: txHash,
      });

      return apiOk({ event: updated ?? event, funding: { ok: true, txHash: fundingTxHash } }, 201);
    } catch (fundErr) {
      // Funding failed — do not create DB record (chain-only). Caller may recover later.
      const message = fundErr instanceof Error ? fundErr.message : 'Funding failed';
      return apiError(`Funding failed: ${message}`, 400, 'VALIDATION_ERROR');
    }
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
  // SYSTEM_ADMIN 전용 목록 조회로 상향 (페이지 정책과 일치)
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
      ? withDerived.filter((e) => (e as { derivedStatus: string }).derivedStatus === derived)
      : withDerived;

    return apiOk({ events: filtered, total });
  } catch (error) {
    console.error('Error in GET /api/admin/events:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
