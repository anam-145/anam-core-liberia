/**
 * EventFactory Service (Stub → On-chain 준비)
 *
 * 현재 기본 동작은 "결정론적 플레이스홀더" 주소/해시를 반환합니다.
 *
 * 온체인 연동 준비사항:
 * - ENV: EVENT_FACTORY_ADDRESS (배포된 Factory 주소)
 * - ABI: src/contracts/abi/EventFactory.json (ethers v6에서 바로 쓰는 ABI 배열)
 * - 네트워크: BASE_RPC_URL, BASE_CHAIN_ID
 * - 서명자: SYSTEM_ADMIN_MNEMONIC (getSystemAdminWallet() 사용 권장)
 *
 * 추후 실제 배포 호출을 추가할 때, ABI/주소가 설정되어 있으면 on-chain으로 시도하고,
 * 실패 시 아래의 결정론적 스텁으로 폴백하는 방식이 안전합니다.
 */
import { JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';
import type { TransactionResponse, InterfaceAbi } from 'ethers';
import EventFactoryABI from '@/contracts/abi/EventFactory.json';
import { getSystemAdminWallet } from '@/services/system-init.service';

type CreateEventFn = {
  staticCall: (
    start: bigint,
    end: bigint,
    amount: bigint,
    max: bigint,
    approvers: string[],
    verifiers: string[],
  ) => Promise<string>;
  (
    start: bigint,
    end: bigint,
    amount: bigint,
    max: bigint,
    approvers: string[],
    verifiers: string[],
  ): Promise<TransactionResponse>;
};

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
  // 1) Try on-chain path if ENV + ABI are set
  const factoryAddr = process.env.EVENT_FACTORY_ADDRESS;
  if (factoryAddr && Array.isArray(EventFactoryABI) && EventFactoryABI.length > 0) {
    try {
      const chainId = parseInt(process.env.BASE_CHAIN_ID || '84532', 10);
      const rpcUrl = process.env.BASE_RPC_URL || '';
      if (!rpcUrl) throw new Error('BASE_RPC_URL is not set');

      const provider = new JsonRpcProvider(rpcUrl, chainId);
      const { privateKey } = getSystemAdminWallet();
      const signer = new Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, provider);
      const factory = new Contract(factoryAddr, EventFactoryABI as InterfaceAbi, signer);

      const start = BigInt(Math.floor(new Date(req.startTime).getTime() / 1000));
      const end = BigInt(Math.floor(new Date(req.endTime).getTime() / 1000));
      const amount6 = parseUnits(String(req.amountPerDay), 6);
      const max = BigInt(req.maxParticipants);
      const approvers = req.approvers || [];
      const verifiers = req.verifiers || [];

      // Predict address via static call (v6: .staticCall)
      let predicted: string | null = null;
      try {
        type CreateEventFn = {
          staticCall: (
            start: bigint,
            end: bigint,
            amount: bigint,
            max: bigint,
            approvers: string[],
            verifiers: string[],
          ) => Promise<string>;
          (
            start: bigint,
            end: bigint,
            amount: bigint,
            max: bigint,
            approvers: string[],
            verifiers: string[],
          ): Promise<TransactionResponse>;
        };
        const createEventFn = (factory as unknown as { createEvent: CreateEventFn }).createEvent;
        predicted = await createEventFn.staticCall(start, end, amount6, max, approvers, verifiers);
      } catch (e) {
        console.debug('[EventFactory] staticCall prediction failed:', e);
        predicted = null;
      }

      const createEvent = (factory as unknown as { createEvent: CreateEventFn }).createEvent;
      const tx = await createEvent(start, end, amount6, max, approvers, verifiers);
      const receipt = await tx.wait();

      // Try to decode EventCreated(eventAddress, creator)
      let deployedAddress = predicted || '0x0000000000000000000000000000000000000000';
      try {
        const iface = (factory as Contract).interface;
        const logs = (
          receipt as unknown as {
            logs: ReadonlyArray<{ address: string; data: string; topics: string[] | readonly string[] }>;
          }
        ).logs;
        for (const log of logs) {
          if (log.address?.toLowerCase() !== factoryAddr.toLowerCase()) continue;
          try {
            const parsed = iface.decodeEventLog('EventCreated', log.data, log.topics);
            const eventAddress = parsed?.[0] as string | undefined;
            if (eventAddress && eventAddress.startsWith('0x')) {
              deployedAddress = eventAddress;
              break;
            }
          } catch (e) {
            console.debug('[EventFactory] Failed to decode EventCreated:', e);
          }
        }
      } catch (e) {
        console.debug('[EventFactory] Log parsing failed:', e);
      }

      return { address: deployedAddress, txHash: tx.hash };
    } catch (err) {
      console.warn('[EventFactory] On-chain createEvent failed, falling back to stub:', err);
    }
  }

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
