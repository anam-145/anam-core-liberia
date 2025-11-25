/**
 * Treasury Management Type Definitions
 */

/**
 * Treasury Transaction - USDC token transfer on Base Network
 */
export interface TreasuryTransaction {
  txHash: string; // Transaction hash
  from: string; // Sender address
  to: string; // Recipient address
  value: string; // Formatted USDC amount (e.g., "100.50")
  gasUsed: string; // Gas units used
  gasPrice: string; // Gas price in Gwei
  timestamp: string; // ISO timestamp
  blockNumber: string; // Block number
}

/**
 * Treasury Balance Response
 */
export interface TreasuryBalance {
  walletAddress: string;
  usdcBalance: string; // Formatted USDC balance
  usdcBalanceRaw: string; // Raw balance (6 decimals)
  ethBalance: string; // Formatted ETH balance
  ethBalanceRaw: string; // Raw balance in Wei
  network: 'Base Sepolia' | 'Base Mainnet';
  timestamp: string;
}

/**
 * Treasury Transactions API Response
 */
export interface TreasuryTransactionsResponse {
  walletAddress: string;
  transactions: TreasuryTransaction[];
  network: 'Base Sepolia' | 'Base Mainnet';
  usdcContract: string;
  source?: 'etherscan_v2';
  message?: string;
}

/**
 * Etherscan API Token Transfer Response
 */
export interface EtherscanTokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string; // Wei value as string
  gasUsed: string;
  gasPrice?: string; // Optional, wei
  timeStamp: string; // Unix timestamp as string
  blockNumber: string;
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

/**
 * Etherscan API Response Wrapper
 */
export interface EtherscanApiResponse<T> {
  status: '0' | '1';
  message: string;
  result: T;
}

export type EtherscanTokenTxResponse = EtherscanApiResponse<EtherscanTokenTransfer[]>;
