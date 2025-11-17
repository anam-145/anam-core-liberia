/**
 * EventFactory Service (Stub)
 *
 * 현재 컨트랙트 배포가 진행 중이라, 실제 배포 대신 "결정론적 플레이스홀더" 주소/해시를 반환합니다.
 *
 * 왜 이렇게 했나요?
 * - 이벤트 테이블에는 `eventContractAddress`에 UNIQUE 제약이 있습니다.
 * - 컨트랙트를 아직 배포하지 않았더라도, 여러 이벤트를 생성할 수 있어야 합니다.
 * - 같은 하드코딩 주소를 매번 저장하면 UNIQUE 제약에 걸려 두 번째부터 실패합니다.
 * - 따라서 이벤트별 고유 식별자(eventId)로부터 결정론적으로 주소/해시를 만들면,
 *   - 각 이벤트마다 유일한 값이 생성되어 UNIQUE 충돌이 없고
 *   - 동일 eventId에 대해 항상 동일 값이 만들어져 idempotent 합니다.
 *
 * 실제 EventFactory 연동 시에는 이 스텁을 제거하고 온체인 배포 결과(address/txHash)를 사용하세요.
 */

export interface CreateEventOnChainRequest {
  /** 이벤트의 고유 ID(UUID). 제공되면 이 값 기반으로 결정론적 주소/해시를 생성합니다. */
  eventId?: string;
  usdcAddress: string;
  startTime: Date;
  endTime: Date;
  amountPerDay: string; // decimal string
  maxParticipants: number;
  approvers?: string[]; // EOA addresses
  verifiers?: string[]; // EOA addresses
}

export interface CreateEventOnChainResponse {
  address: string; // Event contract address
  txHash: string; // Deployment transaction hash
}

// 임시 스텁: 요청 내용을 바탕으로 이벤트마다 고유한 주소/해시를 생성해 UNIQUE 제약 충돌을 피함
export async function createEventOnChain(req: CreateEventOnChainRequest): Promise<CreateEventOnChainResponse> {
  // TODO: 컨트랙트 연결 및 createEvent 호출
  //  - chain: BASE (ENV로 설정)
  //  - signer: SYSTEM_ADMIN mnemonic/privKey
  //  - factory.createEvent(usdc, start, end, amountPerDay, maxParticipants, approvers, verifiers)

  // 작은 지연으로 호출 느낌만 유지
  await new Promise((r) => setTimeout(r, 120));

  const crypto = await import('crypto');

  // 옵션 B: eventId 기반 결정론적 플레이스홀더 생성
  // 동일 eventId → 동일 address/txHash, 서로 다른 eventId → 서로 다른 값(UNIQUE 충돌 회피)
  if (req.eventId) {
    const seed = `event:${req.eventId}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex'); // 64 hex chars
    const address = '0x' + hash.slice(0, 40); // 20 bytes
    const txHash = '0x' + hash; // 32 bytes
    return { address, txHash };
  }

  // eventId가 없으면 기존 방식(유사 난수 기반)으로 고유 값 생성 — 하위호환
  const fallbackSeed = JSON.stringify({
    usdc: req.usdcAddress,
    start: req.startTime?.toISOString?.() ?? String(req.startTime),
    end: req.endTime?.toISOString?.() ?? String(req.endTime),
    amount: req.amountPerDay,
    max: req.maxParticipants,
    approvers: req.approvers || [],
    verifiers: req.verifiers || [],
    now: Date.now(),
    rnd: Math.random(),
  });
  const fallbackHash = crypto.createHash('sha256').update(fallbackSeed).digest('hex');
  const address = '0x' + fallbackHash.slice(0, 40);
  const txHash = '0x' + fallbackHash;
  return { address, txHash };
}
