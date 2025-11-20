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
    if (!normalized.username) fieldErrors.username = 'Please enter a username.';
    if (!normalized.password) fieldErrors.password = 'Please enter a password.';
    if (!normalized.fullName) fieldErrors.fullName = 'Please enter a full name.';

    if (normalized.username && normalized.username.length < 3) {
      fieldErrors.username = 'Username must be at least 3 characters long.';
    }
    // MVP policy: at least 4 characters – can be strengthened later
    if (normalized.password && normalized.password.length < 4) {
      fieldErrors.password = 'Password must be at least 4 characters long.';
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
        fieldErrors: { username: 'This username is already in use.' },
      });
    }
    const emailValue = normalized.email || null;
    if (emailValue) {
      const existingEmail = await repo.findOne({ where: { email: emailValue } });
      if (existingEmail) {
        return apiError('Email already exists', 409, 'CONFLICT', {
          conflict: 'EMAIL_TAKEN',
          fieldErrors: { email: 'This email address is already in use.' },
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
