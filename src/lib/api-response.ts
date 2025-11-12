import { NextResponse } from 'next/server';

/**
 * API 에러 응답 표준 포맷
 */
export interface ApiErrorResponse {
  /** 사용자/개발자용 에러 메시지 */
  error: string;
  /** 머신 리더블 에러 코드 (optional) */
  code?: ErrorCode;
  /** 상세 정보 (Zod validation errors 등) */
  details?: unknown;
}

/**
 * 표준 에러 코드
 */
export type ErrorCode =
  | 'VALIDATION_ERROR' // 400: 입력 검증 실패
  | 'UNAUTHORIZED' // 401: 인증 필요
  | 'FORBIDDEN' // 403: 권한 없음
  | 'NOT_FOUND' // 404: 리소스 없음
  | 'CONFLICT' // 409: 중복/상태 충돌
  | 'INTERNAL_ERROR'; // 500: 서버 오류

/**
 * 성공 응답 헬퍼
 * @param data - 응답 데이터 (도메인 객체)
 * @param status - HTTP 상태 코드 (기본: 200)
 * @returns NextResponse with JSON data
 *
 * @example
 * ```typescript
 * return apiOk({ did: "did:anam:...", txHash: "0x..." }, 201);
 * ```
 */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * 에러 응답 헬퍼
 * @param error - 사람이 읽을 에러 메시지
 * @param status - HTTP 상태 코드
 * @param code - 머신 리더블 에러 코드 (optional)
 * @param details - 상세 정보 (optional)
 * @returns NextResponse with error format
 *
 * @example
 * ```typescript
 * // 간단 버전
 * return apiError('DID Document not found', 404);
 *
 * // 상세 버전
 * return apiError(
 *   'Invalid wallet address format',
 *   400,
 *   'VALIDATION_ERROR',
 *   { walletAddress: 'invalid_format' }
 * );
 * ```
 */
export function apiError(error: string, status: number, code?: ErrorCode, details?: unknown): NextResponse {
  const body: ApiErrorResponse = { error, code, details };
  return NextResponse.json(body, { status });
}
