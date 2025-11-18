/**
 * EventFactory Service — On-chain Only
 *
 * 이 모듈은 EventFactory 컨트랙트를 통해 LiberiaEvent를 실제로 배포합니다.
 *
 * 필수 조건 (ENV):
 * - EVENT_FACTORY_ADDRESS  : 배포된 EventFactory 주소
 * - BASE_RPC_URL           : RPC 엔드포인트(Base Sepolia)
 * - BASE_CHAIN_ID          : 체인 ID(84532)
 * - SYSTEM_ADMIN_MNEMONIC  : 배포/서명자(시스템 관리자) 지갑
 * - ABI: src/contracts/abi/EventFactory.json (ethers v6 InterfaceAbi)
 *
 * 정책:
 * - 온체인 배포 실패 시 에러를 throw 합니다. (DB 등 오프체인 단계를 진행하지 않습니다)
 * - 스텁/폴백(가짜 주소/해시 생성) 경로는 사용하지 않습니다.
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

export async function createEventOnChain(req: CreateEventOnChainRequest): Promise<CreateEventOnChainResponse> {
  // 1) Try on-chain path if ENV + ABI are set
  const factoryAddr = process.env.EVENT_FACTORY_ADDRESS;
  if (!factoryAddr || !Array.isArray(EventFactoryABI) || EventFactoryABI.length === 0) {
    throw new Error('EventFactory is not configured');
  }

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
    const createEventFn = (factory as unknown as { createEvent: CreateEventFn }).createEvent;
    predicted = await createEventFn.staticCall(start, end, amount6, max, approvers, verifiers);
  } catch {
    predicted = null;
  }

  const createEvent = (factory as unknown as { createEvent: CreateEventFn }).createEvent;
  const tx = await createEvent(start, end, amount6, max, approvers, verifiers);
  const receipt = await tx.wait();

  // Decode EventCreated(eventAddress, creator)
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
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  return { address: deployedAddress, txHash: tx.hash };
}
