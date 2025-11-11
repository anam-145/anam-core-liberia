import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum VCStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  SUSPENDED = 'SUSPENDED',
}

@Entity('vc_registry')
export class VcRegistry {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'vc_id',
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'VC unique ID (e.g., vc_kyc_12345)',
  })
  vcId!: string;

  @Column({
    name: 'user_did',
    type: 'varchar',
    length: 255,
    comment: 'VC holder DID',
  })
  userDid!: string;

  @Column({
    name: 'issuer_did',
    type: 'varchar',
    length: 255,
    comment: 'VC issuer DID',
  })
  issuerDid!: string;

  @Column({
    name: 'vc_type',
    type: 'varchar',
    length: 50,
    default: 'UndpKycCredential',
    comment: 'KYC or ADMIN',
  })
  vcType!: string;

  @Column({
    name: 'vc_hash',
    type: 'varchar',
    length: 66,
    comment: 'Keccak256 hash of VC content',
  })
  vcHash!: string;

  @Column({
    type: 'enum',
    enum: VCStatus,
    default: VCStatus.ACTIVE,
  })
  status!: VCStatus;

  @Column({
    name: 'issued_at',
    type: 'timestamp',
  })
  issuedAt!: Date;

  @Column({
    name: 'expires_at',
    type: 'timestamp',
    nullable: true,
  })
  expiresAt?: Date;

  @Column({
    name: 'revoked_at',
    type: 'timestamp',
    nullable: true,
  })
  revokedAt?: Date;

  @Column({
    name: 'revocation_reason',
    type: 'text',
    nullable: true,
  })
  revocationReason?: string;

  @Column({
    name: 'on_chain_tx_hash',
    type: 'varchar',
    length: 66,
    nullable: true,
    comment: 'VCStatusRegistry registration tx',
  })
  onChainTxHash?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
