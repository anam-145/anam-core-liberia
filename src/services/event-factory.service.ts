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

export async function createEventOnChain(_req: CreateEventOnChainRequest): Promise<CreateEventOnChainResponse> {
  // TODO: 컨트랙트 연결 및 createEvent 호출
  //  - chain: BASE (ENV로 설정)
  //  - signer: SYSTEM_ADMIN mnemonic/privKey
  //  - factory.createEvent(usdc, start, end, amountPerDay, maxParticipants, approvers, verifiers)

  // 작은 지연으로 호출 느낌만 유지
  await new Promise((r) => setTimeout(r, 120));

  // 모의 반환값 (유효한 형식)
  return {
    address: '0xDeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD',
    txHash: '0xfeed000000000000000000000000000000000000000000000000000000000000',
  };
}
