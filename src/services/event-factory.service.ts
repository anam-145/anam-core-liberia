/**
 * EventFactory Service (Stub)
 *
 * TODO: 실제 컨트랙트 배포 로직으로 대체.
 * 현재는 고정된 컨트랙트 주소/트랜잭션 해시를 반환하여 API 플로우를 검증합니다.
 */

export interface CreateEventOnChainRequest {
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

  // 요청 + 현재 시간으로 해시를 만들어 이벤트별 고유 값 생성
  const seed = JSON.stringify({
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

  // 생성 규칙: sha256(seed) → 앞 40 hex = 20바이트 EVM 주소, 전체 32바이트 = tx 해시
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(seed).digest('hex'); // 64 hex chars

  // 주소 생성(앞 40자), 0x 접두사
  const address = '0x' + hash.slice(0, 40);
  // txHash는 전체 해시를 사용
  const txHash = '0x' + hash.padEnd(64, '0');

  return { address, txHash };
}
