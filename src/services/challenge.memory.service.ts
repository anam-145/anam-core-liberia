/**
 * Challenge Service - Memory-based Implementation
 *
 * Manages VP challenges in memory with automatic cleanup
 * - Challenge generation and validation
 * - Expiration management
 * - Replay attack prevention (one-time use)
 * - Automatic cleanup of expired challenges
 */

import { generateChallenge } from '@/utils/crypto/did';

export interface ChallengeInfo {
  challenge: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
}

class MemoryChallengeService {
  // In-memory storage: Map<challenge, ChallengeInfo>
  private challenges: Map<string, ChallengeInfo> = new Map();

  // Challenge expiry duration in minutes (from env or default 5 minutes)
  private readonly expiryMinutes: number;

  // Cleanup interval (run every 1 minute)
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.expiryMinutes = parseInt(process.env.CHALLENGE_EXPIRY_MINUTES || '5');

    // Start automatic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000); // Every 1 minute

    console.log(`[ChallengeService] Memory-based service initialized (expiry: ${this.expiryMinutes}m)`);
  }

  /**
   * Generate a new challenge
   * @param length Challenge length in bytes (default: 32)
   * @returns Challenge string (hex format)
   */
  create(length: number = 32): string {
    const challenge = generateChallenge(length);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.expiryMinutes * 60 * 1000);

    this.challenges.set(challenge, {
      challenge,
      createdAt: now,
      expiresAt,
      used: false,
    });

    console.log(
      `[ChallengeService] Created challenge: ${challenge.slice(0, 10)}... (expires: ${expiresAt.toISOString()})`,
    );

    return challenge;
  }

  /**
   * Verify and mark challenge as used
   * @param challenge Challenge to verify
   * @returns true if valid and not used, false otherwise
   * @throws Error if challenge is invalid, expired, or already used
   */
  verify(challenge: string): boolean {
    const info = this.challenges.get(challenge);

    // Challenge not found
    if (!info) {
      throw new Error('Invalid challenge');
    }

    // Already used (replay attack prevention)
    if (info.used) {
      throw new Error('Challenge already used');
    }

    // Check expiration
    const now = new Date();
    if (now > info.expiresAt) {
      this.challenges.delete(challenge);
      throw new Error('Challenge expired');
    }

    // Mark as used
    info.used = true;
    info.usedAt = now;
    this.challenges.set(challenge, info);

    console.log(`[ChallengeService] Verified challenge: ${challenge.slice(0, 10)}...`);

    return true;
  }

  /**
   * Check if challenge exists and is valid (without marking as used)
   * @param challenge Challenge to check
   * @returns true if exists and not expired, false otherwise
   */
  exists(challenge: string): boolean {
    const info = this.challenges.get(challenge);
    if (!info) return false;

    const now = new Date();
    return now <= info.expiresAt;
  }

  /**
   * Get challenge info (for debugging/monitoring)
   * @param challenge Challenge to query
   * @returns ChallengeInfo or undefined
   */
  getInfo(challenge: string): ChallengeInfo | undefined {
    return this.challenges.get(challenge);
  }

  /**
   * Cleanup expired challenges
   * Called automatically every minute
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [challenge, info] of this.challenges.entries()) {
      if (now > info.expiresAt) {
        this.challenges.delete(challenge);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[ChallengeService] Cleaned up ${cleaned} expired challenge(s)`);
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

    for (const info of this.challenges.values()) {
      if (now > info.expiresAt) {
        expired++;
      } else if (info.used) {
        used++;
      } else {
        active++;
      }
    }

    return {
      total: this.challenges.size,
      active,
      used,
      expired,
    };
  }

  /**
   * Clear all challenges (for testing)
   */
  clear(): void {
    this.challenges.clear();
    console.log('[ChallengeService] All challenges cleared');
  }

  /**
   * Cleanup on service shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.challenges.clear();
    console.log('[ChallengeService] Service destroyed');
  }
}

// Singleton instance
// Use globalThis to ensure a single instance across route bundles
const globalKey = '__anamChallengeService';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!(globalThis as Record<string, unknown>)[globalKey]) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  (globalThis as Record<string, unknown>)[globalKey] = new MemoryChallengeService();
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
let challengeServiceInstance: MemoryChallengeService | null = (globalThis as Record<string, unknown>)[
  globalKey
] as MemoryChallengeService | null;

/**
 * Get the singleton challenge service instance
 */
export function getChallengeService(): MemoryChallengeService {
  return challengeServiceInstance as MemoryChallengeService;
}

/**
 * Reset challenge service (for testing)
 */
export function resetChallengeService(): void {
  if (challengeServiceInstance) {
    challengeServiceInstance.destroy();
  }
  challengeServiceInstance = new MemoryChallengeService();
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  (globalThis as Record<string, unknown>)[globalKey] = challengeServiceInstance;
}

export default getChallengeService;
