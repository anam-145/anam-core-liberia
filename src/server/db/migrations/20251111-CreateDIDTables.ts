import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

export class CreateDIDTables1699999999999 implements MigrationInterface {
  name = 'CreateDIDTables1699999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create vc_registry table
    await queryRunner.createTable(
      new Table({
        name: 'vc_registry',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'vc_id',
            type: 'varchar',
            length: '100',
            isUnique: true,
            comment: 'VC unique ID (e.g., vc_kyc_12345)',
          },
          {
            name: 'user_did',
            type: 'varchar',
            length: '255',
            comment: 'VC holder DID',
          },
          {
            name: 'issuer_did',
            type: 'varchar',
            length: '255',
            comment: 'VC issuer DID',
          },
          {
            name: 'vc_type',
            type: 'varchar',
            length: '50',
            default: "'UndpKycCredential'",
            comment: 'KYC or ADMIN',
          },
          {
            name: 'vc_hash',
            type: 'varchar',
            length: '66',
            comment: 'Keccak256 hash of VC content',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['ACTIVE', 'REVOKED', 'SUSPENDED'],
            default: "'ACTIVE'",
          },
          {
            name: 'issued_at',
            type: 'timestamp',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'revoked_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'revocation_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'on_chain_tx_hash',
            type: 'varchar',
            length: '66',
            isNullable: true,
            comment: 'VCStatusRegistry registration tx',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for vc_registry
    await queryRunner.createIndex(
      'vc_registry',
      new TableIndex({
        name: 'idx_user_did',
        columnNames: ['user_did'],
      }),
    );
    await queryRunner.createIndex(
      'vc_registry',
      new TableIndex({
        name: 'idx_status',
        columnNames: ['status'],
      }),
    );
    await queryRunner.createIndex(
      'vc_registry',
      new TableIndex({
        name: 'idx_expires',
        columnNames: ['expires_at'],
      }),
    );
    await queryRunner.createIndex(
      'vc_registry',
      new TableIndex({
        name: 'idx_vc_type',
        columnNames: ['vc_type'],
      }),
    );

    // Create did_documents table
    await queryRunner.createTable(
      new Table({
        name: 'did_documents',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'did',
            type: 'varchar',
            length: '255',
            isUnique: true,
            comment: 'Full DID string (did:anam:undp-lr:type:identifier)',
          },
          {
            name: 'did_type',
            type: 'enum',
            enum: ['USER', 'ISSUER'],
          },
          {
            name: 'wallet_address',
            type: 'varchar',
            length: '42',
            comment: 'Ethereum address',
          },
          {
            name: 'public_key_hex',
            type: 'varchar',
            length: '132',
            comment: '65-byte uncompressed public key',
          },
          {
            name: 'document_json',
            type: 'json',
            comment: 'Full DID Document',
          },
          {
            name: 'document_hash',
            type: 'varchar',
            length: '66',
            comment: 'Keccak256 hash for on-chain verification',
          },
          {
            name: 'on_chain_tx_hash',
            type: 'varchar',
            length: '66',
            isNullable: true,
            comment: 'DIDRegistry registration tx',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for did_documents
    await queryRunner.createIndex(
      'did_documents',
      new TableIndex({
        name: 'idx_wallet_address',
        columnNames: ['wallet_address'],
      }),
    );
    await queryRunner.createIndex(
      'did_documents',
      new TableIndex({
        name: 'idx_did_type',
        columnNames: ['did_type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes and tables in reverse order
    await queryRunner.dropIndex('did_documents', 'idx_did_type');
    await queryRunner.dropIndex('did_documents', 'idx_wallet_address');
    await queryRunner.dropTable('did_documents');

    await queryRunner.dropIndex('vc_registry', 'idx_vc_type');
    await queryRunner.dropIndex('vc_registry', 'idx_expires');
    await queryRunner.dropIndex('vc_registry', 'idx_status');
    await queryRunner.dropIndex('vc_registry', 'idx_user_did');
    await queryRunner.dropTable('vc_registry');
  }
}
