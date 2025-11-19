import type { NextRequest } from 'next/server';
import { apiError, apiOk } from '@/lib/api-response';
import AppDataSource from '@/server/db/datasource';
import { Admin, AdminRole, OnboardingStatus } from '@/server/db/entities/Admin';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { ensureDataSource } from '@/server/db/ensureDataSource';

/**
 * POST /api/public/admins/signup
 * 신규 관리자 신청 (공개 엔드포인트)
 *
 * Request:
 * - username: string
 * - password: string
 * - fullName: string
 * - email?: string
 *
 * Response(201): { adminId, status: 'PENDING_REVIEW' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, fullName, email } = (body || {}) as {
      username?: string;
      password?: string;
      fullName?: string;
      email?: string;
    };

    // Normalize inputs
    const normalized = {
      username: (username ?? '').trim().toLowerCase(),
      password: password ?? '',
      fullName: (fullName ?? '').trim(),
      email: (email ?? '').trim(),
    };

    // Collect field errors (MVP minimal)
    const fieldErrors: Record<string, string> = {};
    if (!normalized.username) fieldErrors.username = '아이디를 입력해 주세요.';
    if (!normalized.password) fieldErrors.password = '비밀번호를 입력해 주세요.';
    if (!normalized.fullName) fieldErrors.fullName = '이름을 입력해 주세요.';

    if (normalized.username && normalized.username.length < 3) {
      fieldErrors.username = '아이디는 최소 3자 이상이어야 합니다.';
    }
    // MVP: 허용 정책(4자 이상) - 이후 강화 가능
    if (normalized.password && normalized.password.length < 4) {
      fieldErrors.password = '비밀번호는 최소 4자 이상이어야 합니다.';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return apiError('Validation failed', 400, 'VALIDATION_ERROR', { fieldErrors });
    }

    // Initialize DB (serialized) and repo
    await ensureDataSource();
    const repo = AppDataSource.getRepository(Admin);

    // Uniqueness checks
    const existingUsername = await repo.findOne({ where: { username: normalized.username } });
    if (existingUsername) {
      return apiError('Username already exists', 409, 'CONFLICT', {
        conflict: 'USERNAME_TAKEN',
        fieldErrors: { username: '이미 사용 중인 아이디입니다.' },
      });
    }
    const emailValue = normalized.email || null;
    if (emailValue) {
      const existingEmail = await repo.findOne({ where: { email: emailValue } });
      if (existingEmail) {
        return apiError('Email already exists', 409, 'CONFLICT', {
          conflict: 'EMAIL_TAKEN',
          fieldErrors: { email: '이미 사용 중인 이메일입니다.' },
        });
      }
    }

    const passwordHash = await hash(normalized.password, 10);

    const admin = repo.create({
      adminId: randomUUID(),
      username: normalized.username,
      passwordHash,
      fullName: normalized.fullName,
      email: emailValue,
      role: AdminRole.STAFF,
      isActive: false,
      onboardingStatus: OnboardingStatus.PENDING_REVIEW,
      did: null,
      walletAddress: null,
    });

    await repo.save(admin);

    return apiOk({ adminId: admin.adminId, status: 'PENDING_REVIEW' }, 201);
  } catch (error) {
    console.error('Error in POST /api/public/admins/signup:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
