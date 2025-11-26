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

// PaymentApproved(address indexed participant, address indexed approver, uint256 indexed day, uint256 amount)
const PAYMENT_APPROVED_TOPIC = ethers.id('PaymentApproved(address,address,uint256,uint256)');

interface EtherscanLogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
  logIndex: string;
  transactionHash: string;
  transactionIndex: string;
}

/**
 * GET /api/admin/events/[eventId]/audit/payments
 * Audit payments by comparing on-chain logs with off-chain DB
 * Uses Basescan API for log queries (no block range limits)
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

    // 2) Get on-chain logs via Etherscan V2 API (supports all chains with single API key)
    const chainId = process.env.BASE_CHAIN_ID || '8453';
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
    if (!etherscanApiKey) {
      return apiError('Missing ETHERSCAN_API_KEY configuration', 500, 'INTERNAL_ERROR');
    }

    const etherscanUrl = new URL('https://api.etherscan.io/v2/api');
    etherscanUrl.searchParams.set('chainid', chainId);
    etherscanUrl.searchParams.set('module', 'logs');
    etherscanUrl.searchParams.set('action', 'getLogs');
    etherscanUrl.searchParams.set('address', event.eventContractAddress);
    etherscanUrl.searchParams.set('topic0', PAYMENT_APPROVED_TOPIC);
    etherscanUrl.searchParams.set('fromBlock', '0');
    etherscanUrl.searchParams.set('toBlock', 'latest');
    etherscanUrl.searchParams.set('apikey', etherscanApiKey);

    const response = await fetch(etherscanUrl.toString());
    const data = await response.json();

    if (data.status !== '1' && data.message !== 'No records found') {
      console.error('Etherscan V2 API error:', data);
      return apiError(`Etherscan API error: ${data.message || 'Unknown error'}`, 500, 'INTERNAL_ERROR');
    }

    const logs: EtherscanLogEntry[] = data.result || [];

    // Parse on-chain logs
    const onChainRecords = logs.map((log) => {
      // Decode indexed parameters from topics
      // topics[0] = event signature, topics[1] = participant, topics[2] = approver, topics[3] = day
      // amount is in data (not indexed)
      const participant = '0x' + log.topics[1]?.slice(26);
      const approver = '0x' + log.topics[2]?.slice(26);
      const day = parseInt(log.topics[3] || '0', 16);
      const amount = BigInt(log.data || '0').toString();

      return {
        participant: participant.toLowerCase(),
        approver: approver.toLowerCase(),
        day,
        amount,
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
