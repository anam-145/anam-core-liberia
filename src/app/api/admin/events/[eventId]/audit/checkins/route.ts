import type { NextRequest } from 'next/server';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { EventCheckin } from '@/server/db/entities/EventCheckin';
import { User } from '@/server/db/entities/User';
import { Admin } from '@/server/db/entities/Admin';
import { adminService } from '@/services/admin.service';
import { ethers } from 'ethers';

const LIBERIA_EVENT_ABI = [
  'event CheckInVerified(address indexed participant, address indexed verifier, uint256 indexed day)',
];

/**
 * GET /api/admin/events/[eventId]/audit/checkins
 * Audit check-ins by comparing on-chain logs with off-chain DB
 */
export async function GET(_request: NextRequest, { params }: { params: { eventId: string } }) {
  const authCheck = await requireEventRole(params.eventId, [EventRole.APPROVER, EventRole.VERIFIER]);
  if (authCheck) return authCheck;

  try {
    // 1) Load event to get contract address
    const event = await adminService.getEventByEventId(params.eventId);
    if (!event) {
      return apiError('Event not found', 404, 'NOT_FOUND');
    }
    if (!event.eventContractAddress) {
      return apiError('Event contract not deployed', 409, 'CONFLICT');
    }

    // 2) Get on-chain logs
    const rpcUrl = process.env.BASE_RPC_URL;
    if (!rpcUrl) {
      return apiError('Missing BASE_RPC_URL configuration', 500, 'INTERNAL_ERROR');
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const iface = new ethers.Interface(LIBERIA_EVENT_ABI);
    const eventTopic = iface.getEvent('CheckInVerified')?.topicHash;
    if (!eventTopic) {
      return apiError('Failed to get event topic', 500, 'INTERNAL_ERROR');
    }

    // Query logs - estimate start block from event creation date to avoid querying from block 0
    const latestBlock = await provider.getBlockNumber();
    const eventCreatedAt = new Date(event.createdAt).getTime();
    const now = Date.now();
    const blockTime = 2000; // Base ~2s per block
    const blocksAgo = Math.floor((now - eventCreatedAt) / blockTime);
    const estimatedStartBlock = Math.max(0, latestBlock - blocksAgo - 10000); // Add buffer

    const logs: ethers.Log[] = [];
    const CHUNK_SIZE = 2000; // Safe chunk size for most providers

    for (let fromBlock = estimatedStartBlock; fromBlock <= latestBlock; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock);
      const chunk = await provider.getLogs({
        address: event.eventContractAddress,
        topics: [eventTopic],
        fromBlock,
        toBlock,
      });
      logs.push(...chunk);
    }

    // Parse on-chain logs
    const onChainRecords = logs.map((log) => {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      return {
        participant: parsed?.args[0]?.toLowerCase() as string,
        verifier: parsed?.args[1]?.toLowerCase() as string,
        day: Number(parsed?.args[2]),
        txHash: log.transactionHash,
      };
    });

    // 3) Get off-chain DB records
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const checkinRepo = AppDataSource.getRepository(EventCheckin);
    const dbRecords = await checkinRepo
      .createQueryBuilder('c')
      .leftJoin(User, 'u', 'u.user_id = c.user_id')
      .leftJoin(Admin, 'a', 'a.admin_id = c.checked_in_by_admin_id')
      .select([
        'c.checkin_id AS checkinId',
        'c.checked_in_at AS checkedInAt',
        'c.checkin_tx_hash AS txHash',
        'u.wallet_address AS participantWallet',
        'u.name AS participantName',
        'a.wallet_address AS verifierWallet',
        'a.full_name AS verifierName',
      ])
      .where('c.event_id = :eventId', { eventId: params.eventId })
      .getRawMany();

    // 4) Compare and find discrepancies
    const discrepancies: Array<{
      type: 'MISSING_ON_CHAIN' | 'MISSING_OFF_CHAIN' | 'VERIFIER_MISMATCH';
      txHash: string | null;
      onChain: { participant: string; verifier: string; day: number } | null;
      offChain: {
        participantName: string;
        participantWallet: string;
        verifierName: string;
        verifierWallet: string;
        checkedInAt: string;
      } | null;
    }> = [];

    // Create lookup maps
    const onChainByTx = new Map(onChainRecords.map((r) => [r.txHash.toLowerCase(), r]));
    const dbByTx = new Map(dbRecords.filter((r) => r.txHash).map((r) => [r.txHash.toLowerCase(), r]));

    // Check each on-chain record against DB
    for (const onChain of onChainRecords) {
      const txHashLower = onChain.txHash.toLowerCase();
      const dbRecord = dbByTx.get(txHashLower);

      if (!dbRecord) {
        discrepancies.push({
          type: 'MISSING_OFF_CHAIN',
          txHash: onChain.txHash,
          onChain: { participant: onChain.participant, verifier: onChain.verifier, day: onChain.day },
          offChain: null,
        });
      } else {
        // Check verifier mismatch
        const dbVerifierWallet = dbRecord.verifierWallet?.toLowerCase();
        if (dbVerifierWallet && dbVerifierWallet !== onChain.verifier) {
          discrepancies.push({
            type: 'VERIFIER_MISMATCH',
            txHash: onChain.txHash,
            onChain: { participant: onChain.participant, verifier: onChain.verifier, day: onChain.day },
            offChain: {
              participantName: dbRecord.participantName,
              participantWallet: dbRecord.participantWallet,
              verifierName: dbRecord.verifierName,
              verifierWallet: dbRecord.verifierWallet,
              checkedInAt: dbRecord.checkedInAt,
            },
          });
        }
      }
    }

    // Check DB records without on-chain match
    for (const db of dbRecords) {
      if (db.txHash && !onChainByTx.has(db.txHash.toLowerCase())) {
        discrepancies.push({
          type: 'MISSING_ON_CHAIN',
          txHash: db.txHash,
          onChain: null,
          offChain: {
            participantName: db.participantName,
            participantWallet: db.participantWallet,
            verifierName: db.verifierName,
            verifierWallet: db.verifierWallet,
            checkedInAt: db.checkedInAt,
          },
        });
      }
    }

    return apiOk({
      totalOnChain: onChainRecords.length,
      totalOffChain: dbRecords.length,
      discrepancies,
      isValid: discrepancies.length === 0,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/events/[eventId]/audit/checkins:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
