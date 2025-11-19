/**
 * Challenge Memory Service Tests
 */

import { getChallengeService, resetChallengeService } from '../challenge.memory.service';

// 메모리 기반 Challenge 서비스 검증
describe('Memory-based Challenge Service', () => {
  let service: ReturnType<typeof getChallengeService>;

  beforeEach(() => {
    resetChallengeService();
    service = getChallengeService();
  });

  afterEach(() => {
    service.clear();
  });

  // Challenge 생성 테스트
  describe('Challenge Creation', () => {
    // Challenge를 생성할 수 있어야 함
    it('should create a challenge', () => {
      const challenge = service.create();

      expect(challenge).toBeDefined();
      expect(challenge).toMatch(/^0x[0-9a-fA-F]{64}$/); // 32 bytes = 64 hex chars
      expect(service.exists(challenge)).toBe(true);
    });

    // 서로 다른 Challenge를 생성해야 함
    it('should create unique challenges', () => {
      const challenge1 = service.create();
      const challenge2 = service.create();

      expect(challenge1).not.toBe(challenge2);
      expect(service.exists(challenge1)).toBe(true);
      expect(service.exists(challenge2)).toBe(true);
    });

    // Challenge 정보를 조회할 수 있어야 함
    it('should get challenge info', () => {
      const challenge = service.create();
      const info = service.getInfo(challenge);

      expect(info).toBeDefined();
      expect(info?.challenge).toBe(challenge);
      expect(info?.used).toBe(false);
      expect(info?.createdAt).toBeInstanceOf(Date);
      expect(info?.expiresAt).toBeInstanceOf(Date);
    });
  });

  // Challenge 검증 테스트
  describe('Challenge Verification', () => {
    // 유효한 Challenge를 검증할 수 있어야 함
    it('should verify valid challenge', () => {
      const challenge = service.create();
      const isValid = service.verify(challenge);

      expect(isValid).toBe(true);
    });

    // Challenge는 1회만 사용 가능해야 함 (Replay Attack 방지)
    it('should reject already used challenge', () => {
      const challenge = service.create();

      // First use - should succeed
      expect(service.verify(challenge)).toBe(true);

      // Second use - should fail
      expect(() => service.verify(challenge)).toThrow('Challenge already used');
    });

    // 존재하지 않는 Challenge는 거부해야 함
    it('should reject non-existent challenge', () => {
      const fakeChallenge = '0x' + '1'.repeat(64);

      expect(() => service.verify(fakeChallenge)).toThrow('Invalid challenge');
    });

    // 만료된 Challenge는 거부해야 함
    it('should reject expired challenge', () => {
      // Mock Date to test expiration
      const realDate = Date;
      const mockNow = new Date('2025-01-01T00:00:00Z');

      global.Date = class extends Date {
        constructor() {
          super();
          return mockNow;
        }
        static now() {
          return mockNow.getTime();
        }
      } as unknown as DateConstructor;

      const challenge = service.create();

      // Restore Date and move forward 10 minutes (past expiry)
      global.Date = realDate;
      const futureDate = new Date(mockNow.getTime() + 10 * 60 * 1000);
      jest.spyOn(global, 'Date').mockImplementation(() => futureDate as unknown as Date);

      expect(() => service.verify(challenge)).toThrow('Challenge expired');

      jest.restoreAllMocks();
    });
  });

  // 통계 및 관리 기능 테스트
  describe('Management Features', () => {
    // 통계를 조회할 수 있어야 함
    it('should get statistics', () => {
      const challenge1 = service.create();
      const _challenge2 = service.create();
      service.verify(challenge1);

      const stats = service.getStats();

      expect(stats.total).toBe(2);
      expect(stats.active).toBe(1); // challenge2 is still active
      expect(stats.used).toBe(1); // challenge1 is used
    });

    // 모든 Challenge를 삭제할 수 있어야 함
    it('should clear all challenges', () => {
      service.create();
      service.create();

      expect(service.getStats().total).toBe(2);

      service.clear();

      expect(service.getStats().total).toBe(0);
    });
  });

  // Singleton 패턴 테스트
  describe('Singleton Pattern', () => {
    // 같은 인스턴스를 반환해야 함
    it('should return same instance', () => {
      const instance1 = getChallengeService();
      const instance2 = getChallengeService();

      expect(instance1).toBe(instance2);
    });

    // Reset 후 새 인스턴스를 생성해야 함
    it('should create new instance after reset', () => {
      const instance1 = getChallengeService();
      instance1.create();

      expect(instance1.getStats().total).toBe(1);

      resetChallengeService();
      const instance2 = getChallengeService();

      expect(instance2.getStats().total).toBe(0);
    });
  });
});
