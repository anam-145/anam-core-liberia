import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DIDType {
  USER = 'USER',
  ISSUER = 'ISSUER',
}

@Entity('did_documents')
export class DidDocument {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    comment: 'Full DID string (did:anam:undp-lr:type:identifier)',
  })
  did!: string;

  @Column({
    name: 'did_type',
    type: 'enum',
    enum: DIDType,
  })
  didType!: DIDType;

  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    comment: 'Ethereum address',
  })
  walletAddress!: string;

  @Column({
    name: 'public_key_hex',
    type: 'varchar',
    length: 132,
    comment: '65-byte uncompressed public key',
  })
  publicKeyHex!: string;

  @Column({
    name: 'document_json',
    type: 'json',
    comment: 'Full DID Document',
  })
  documentJson!: any;

  @Column({
    name: 'document_hash',
    type: 'varchar',
    length: 66,
    comment: 'Keccak256 hash for on-chain verification',
  })
  documentHash!: string;

  @Column({
    name: 'on_chain_tx_hash',
    type: 'varchar',
    length: 66,
    nullable: true,
    comment: 'DIDRegistry registration tx',
  })
  onChainTxHash?: string;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Whether this DID is active',
  })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
