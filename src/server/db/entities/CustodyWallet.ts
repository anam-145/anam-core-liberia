import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import type { Vault } from '@/utils/crypto/vault';
import type { VerifiableCredential } from '@/utils/crypto/did';

export enum WalletType {
  ANAMWALLET = 'ANAMWALLET',
  USSD = 'USSD',
  PAPER_VOUCHER = 'PAPER_VOUCHER',
}

@Entity('custody_wallets')
export class CustodyWallet {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'custody_id',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: 'Custody unique ID',
  })
  custodyId!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 36,
    comment: 'User ID',
  })
  @Index()
  userId!: string;

  @Column({
    name: 'wallet_type',
    type: 'enum',
    enum: WalletType,
    comment: 'ANAMWALLET, USSD, or PAPER_VOUCHER',
  })
  walletType!: WalletType;

  @Column({
    name: 'phone_number',
    type: 'varchar',
    length: 20,
    unique: true,
    nullable: true,
    comment: 'USSD user phone number',
  })
  phoneNumber!: string | null;

  @Column({
    type: 'json',
    comment: 'Encrypted vault (ciphertext, iv, salt, authTag)',
  })
  vault!: Vault;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Verifiable Credential',
  })
  vc!: VerifiableCredential | null;

  @Column({
    name: 'is_backup',
    type: 'boolean',
    default: false,
    comment: 'Backup flag (required for USSD, optional for others)',
  })
  isBackup!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
