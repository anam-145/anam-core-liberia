import type { NextRequest } from 'next/server';
import { requireEventRole } from '@/lib/auth-middleware';
import { apiOk, apiError } from '@/lib/api-response';
import { EventRole } from '@/server/db/entities/EventStaff';
import { AppDataSource } from '@/server/db/datasource';
import { EventPayment } from '@/server/db/entities/EventPayment';
import { User } from '@/server/db/entities/User';
import { Admin } from '@/server/db/entities/Admin';
import { adminService } from '@/services/admin.service';
import { ethers } from 'ethers';

const LIBERIA_EVENT_ABI = [
  'event PaymentApproved(address indexed participant, address indexed approver, uint256 indexed day, uint256 amount)',
];

/**
 * GET /api/admin/events/[eventId]/audit/payments
 * Audit payments by comparing on-chain logs with off-chain DB
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

    // 2) Get on-chain logs - Use public RPC for audit (no block range limits)
    const auditRpcUrl = process.env.AUDIT_RPC_URL || 'https://sepolia.base.org';
    const provider = new ethers.JsonRpcProvider(auditRpcUrl);
    const iface = new ethers.Interface(LIBERIA_EVENT_ABI);
    const eventTopic = iface.getEvent('PaymentApproved')?.topicHash;
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
        approver: parsed?.args[1]?.toLowerCase() as string,
        day: Number(parsed?.args[2]),
        amount: parsed?.args[3]?.toString() as string,
        txHash: log.transactionHash,
      };
    });

    // 3) Get off-chain DB records
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const paymentRepo = AppDataSource.getRepository(EventPayment);
    const dbRecords = await paymentRepo
      .createQueryBuilder('p')
      .leftJoin(User, 'u', 'u.user_id = p.user_id')
      .leftJoin(Admin, 'a', 'a.admin_id = p.paid_by_admin_id')
      .select([
        'p.id AS id',
        'p.amount AS amount',
        'p.paid_at AS paidAt',
        'p.payment_tx_hash AS txHash',
        'u.wallet_address AS participantWallet',
        'u.name AS participantName',
        'a.wallet_address AS approverWallet',
        'a.full_name AS approverName',
      ])
      .where('p.event_id = :eventId', { eventId: params.eventId })
      .getRawMany();

    // 4) Compare and find discrepancies
    const discrepancies: Array<{
      type: 'MISSING_ON_CHAIN' | 'MISSING_OFF_CHAIN' | 'APPROVER_MISMATCH';
      txHash: string | null;
      onChain: { participant: string; approver: string; day: number; amount: string } | null;
      offChain: {
        participantName: string;
        participantWallet: string;
        approverName: string;
        approverWallet: string;
        paidAt: string;
        amount: string;
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
          onChain: {
            participant: onChain.participant,
            approver: onChain.approver,
            day: onChain.day,
            amount: onChain.amount,
          },
          offChain: null,
        });
      } else {
        // Check approver mismatch
        const dbApproverWallet = dbRecord.approverWallet?.toLowerCase();
        if (dbApproverWallet && dbApproverWallet !== onChain.approver) {
          discrepancies.push({
            type: 'APPROVER_MISMATCH',
            txHash: onChain.txHash,
            onChain: {
              participant: onChain.participant,
              approver: onChain.approver,
              day: onChain.day,
              amount: onChain.amount,
            },
            offChain: {
              participantName: dbRecord.participantName,
              participantWallet: dbRecord.participantWallet,
              approverName: dbRecord.approverName,
              approverWallet: dbRecord.approverWallet,
              paidAt: dbRecord.paidAt,
              amount: dbRecord.amount,
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
            approverName: db.approverName,
            approverWallet: db.approverWallet,
            paidAt: db.paidAt,
            amount: db.amount,
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
    console.error('Error in GET /api/admin/events/[eventId]/audit/payments:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
