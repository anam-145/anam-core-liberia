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

// CheckInVerified(address indexed participant, address indexed verifier, uint256 indexed day)
const CHECKIN_VERIFIED_TOPIC = ethers.id('CheckInVerified(address,address,uint256)');

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
 * GET /api/admin/events/[eventId]/audit/checkins
 * Audit check-ins by comparing on-chain logs with off-chain DB
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
    etherscanUrl.searchParams.set('topic0', CHECKIN_VERIFIED_TOPIC);
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
      // topics[0] = event signature, topics[1] = participant, topics[2] = verifier, topics[3] = day
      const participant = '0x' + log.topics[1]?.slice(26); // Remove padding
      const verifier = '0x' + log.topics[2]?.slice(26);
      const day = parseInt(log.topics[3] || '0', 16);

      return {
        participant: participant.toLowerCase(),
        verifier: verifier.toLowerCase(),
        day,
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
