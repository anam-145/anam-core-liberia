/**
 * VP Session Service - Memory-based Implementation
 *
 * Manages VP sessions in memory with automatic cleanup
 * - Session ID generation and validation
 * - VP storage with expiration
 * - One-time retrieval (session consumed after use)
 * - Automatic cleanup of expired sessions
 */

import { randomBytes } from 'crypto';
import type { VerifiablePresentation } from '@/utils/crypto/did';

export type VPSessionStatus = 'pending' | 'verified' | 'failed' | 'expired';

export interface VPSessionInfo {
  sessionId: string;
  vp: VerifiablePresentation;
  challenge: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  status: VPSessionStatus;
  verifiedAt?: Date;
  checkinData?: {
    eventName: string;
    userName: string;
    userDID: string;
  };
}

class MemoryVPSessionService {
  // In-memory storage: Map<sessionId, VPSessionInfo>
  private sessions: Map<string, VPSessionInfo> = new Map();

  // Session expiry duration in minutes (from env or default 5 minutes)
  private readonly expiryMinutes: number;

  // Cleanup interval (run every 1 minute)
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.expiryMinutes = parseInt(process.env.VP_SESSION_EXPIRY_MINUTES || '5');

    // Start automatic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000); // Every 1 minute

    console.log(`[VPSessionService] Memory-based service initialized (expiry: ${this.expiryMinutes}m)`);
  }

  /**
   * Generate a random session ID
   * @returns Session ID (32-char hex string)
   */
  private generateSessionId(): string {
    return randomBytes(16).toString('hex'); // 32 characters
  }

  /**
   * Create a new VP session
   * @param vp Verifiable Presentation
   * @param challenge Challenge used in VP
   * @returns Session ID
   */
  create(vp: VerifiablePresentation, challenge: string): string {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expiryMinutes * 60 * 1000);

    this.sessions.set(sessionId, {
      sessionId,
      vp,
      challenge,
      createdAt: now,
      expiresAt,
      used: false,
      status: 'pending',
    });

    console.log(`[VPSessionService] Created session: ${sessionId} (expires: ${expiresAt.toISOString()})`);

    return sessionId;
  }

  /**
   * Update session status (for polling)
   * @param sessionId Session ID
   * @param status New status
   * @param checkinData Optional checkin data (for verified status)
   */
  updateStatus(
    sessionId: string,
    status: VPSessionStatus,
    checkinData?: { eventName: string; userName: string; userDID: string },
  ): void {
    const info = this.sessions.get(sessionId);
    if (!info) {
      console.warn(`[VPSessionService] Cannot update status: session ${sessionId} not found`);
      return;
    }

    info.status = status;
    if (status === 'verified') {
      info.verifiedAt = new Date();
      info.checkinData = checkinData;
    }

    this.sessions.set(sessionId, info);
    console.log(`[VPSessionService] Updated session ${sessionId} status: ${status}`);
  }

  /**
   * Get session status (for polling, without consuming)
   * @param sessionId Session ID
   * @returns Session info or null if not found/expired
   */
  getStatus(sessionId: string): VPSessionInfo | null {
    const info = this.sessions.get(sessionId);
    if (!info) {
      return null;
    }

    const now = new Date();
    if (now > info.expiresAt) {
      info.status = 'expired';
      this.sessions.set(sessionId, info);
    }

    return info;
  }

  /**
   * Verify and mark VP session as used (does NOT delete)
   * @param sessionId Session ID to verify
   * @returns VPSessionInfo if valid
   * @throws Error if session is invalid, expired, or already used
   */
  verifyAndMarkUsed(sessionId: string): VPSessionInfo {
    const info = this.sessions.get(sessionId);

    // Session not found
    if (!info) {
      throw new Error('Invalid session ID');
    }

    // Already used (replay attack prevention)
    if (info.used) {
      throw new Error('Session already used');
    }

    // Check expiration
    const now = new Date();
    if (now > info.expiresAt) {
      this.sessions.delete(sessionId);
      throw new Error('Session expired');
    }

    // Mark as used but keep in memory for polling
    info.used = true;
    info.usedAt = now;
    this.sessions.set(sessionId, info);

    console.log(`[VPSessionService] Verified and marked session as used: ${sessionId}`);

    return info;
  }

  /**
   * Retrieve and consume VP session (one-time use)
   * @param sessionId Session ID to retrieve
   * @returns VPSessionInfo if valid, null otherwise
   * @throws Error if session is invalid, expired, or already used
   * @deprecated Use verifyAndMarkUsed() for AnamWallet check-in flow
   */
  consume(sessionId: string): VPSessionInfo {
    const info = this.sessions.get(sessionId);

    // Session not found
    if (!info) {
      throw new Error('Invalid session ID');
    }

    // Already used (replay attack prevention)
    if (info.used) {
      throw new Error('Session already used');
    }

    // Check expiration
    const now = new Date();
    if (now > info.expiresAt) {
      this.sessions.delete(sessionId);
      throw new Error('Session expired');
    }

    // Mark as used and delete immediately (one-time use)
    info.used = true;
    info.usedAt = now;
    this.sessions.delete(sessionId);

    console.log(`[VPSessionService] Consumed session: ${sessionId}`);

    return info;
  }

  /**
   * Check if session exists and is valid (without consuming)
   * @param sessionId Session ID to check
   * @returns true if exists and not expired, false otherwise
   */
  exists(sessionId: string): boolean {
    const info = this.sessions.get(sessionId);
    if (!info) return false;

    const now = new Date();
    return now <= info.expiresAt && !info.used;
  }

  /**
   * Get session info (for debugging/monitoring, without consuming)
   * @param sessionId Session ID to query
   * @returns VPSessionInfo or undefined
   */
  getInfo(sessionId: string): VPSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Cleanup expired sessions and old verified sessions
   * Called automatically every minute
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, info] of this.sessions.entries()) {
      let shouldDelete = false;

      // 1) Delete expired sessions
      if (now > info.expiresAt) {
        shouldDelete = true;
      }

      // 2) Delete verified sessions older than 30 seconds (for polling grace period)
      if (info.status === 'verified' && info.verifiedAt) {
        const timeSinceVerified = now.getTime() - info.verifiedAt.getTime();
        if (timeSinceVerified > 30 * 1000) {
          // 30 seconds
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[VPSessionService] Cleaned up ${cleaned} expired/old session(s)`);
    }
  }

  /**
   * Get statistics (for monitoring)
   */
  getStats(): { total: number; active: number; used: number; expired: number } {
    const now = new Date();
    let active = 0;
    let used = 0;
    let expired = 0;

    for (const info of this.sessions.values()) {
      if (now > info.expiresAt) {
        expired++;
      } else if (info.used) {
        used++;
      } else {
        active++;
      }
    }

    return {
      total: this.sessions.size,
      active,
      used,
      expired,
    };
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.sessions.clear();
    console.log('[VPSessionService] All sessions cleared');
  }

  /**
   * Cleanup on service shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    console.log('[VPSessionService] Service destroyed');
  }
}

// Singleton instance
// Use globalThis to ensure a single instance across route bundles
const globalKey = '__anamVPSessionService';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!(globalThis as Record<string, unknown>)[globalKey]) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  (globalThis as Record<string, unknown>)[globalKey] = new MemoryVPSessionService();
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
let vpSessionServiceInstance: MemoryVPSessionService | null = (globalThis as Record<string, unknown>)[
  globalKey
] as MemoryVPSessionService | null;

/**
 * Get the singleton VP session service instance
 */
export function getVPSessionService(): MemoryVPSessionService {
  return vpSessionServiceInstance as MemoryVPSessionService;
}

/**
 * Reset VP session service (for testing)
 */
export function resetVPSessionService(): void {
  if (vpSessionServiceInstance) {
    vpSessionServiceInstance.destroy();
  }
  vpSessionServiceInstance = new MemoryVPSessionService();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  (globalThis as Record<string, unknown>)[globalKey] = vpSessionServiceInstance;
}

export default getVPSessionService;
