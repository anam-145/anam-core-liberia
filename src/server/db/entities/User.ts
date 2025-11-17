import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum KycType {
  NIR = 'NIR',
  PASSPORT = 'PASSPORT',
  BIRTH_CERT = 'BIRTH_CERT',
  NATURALIZATION = 'NATURALIZATION',
  SWORN_STATEMENT = 'SWORN_STATEMENT',
  CHIEF_CERT = 'CHIEF_CERT',
}

export enum USSDStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 36,
    unique: true,
    comment: 'UUID unique identifier',
  })
  userId!: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: 255,
    comment: 'User full name',
  })
  name!: string;

  @Column({
    name: 'phone_number',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'Phone number',
  })
  @Index()
  phoneNumber!: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Email address',
  })
  email!: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: 'Gender (MALE, FEMALE, OTHER)',
  })
  gender!: string | null;

  @Column({
    name: 'date_of_birth',
    type: 'date',
    nullable: true,
    comment: 'Date of birth',
  })
  dateOfBirth!: Date | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Nationality',
  })
  nationality!: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Residential address',
  })
  address!: string | null;

  // KYC Fields
  @Column({
    name: 'kyc_type',
    type: 'enum',
    enum: KycType,
    nullable: true,
    comment: 'KYC document type',
  })
  kycType!: KycType | null;

  @Column({
    name: 'kyc_document_number',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'ID number',
  })
  kycDocumentNumber!: string | null;

  @Column({
    name: 'kyc_document_path',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Path to KYC document scan',
  })
  kycDocumentPath!: string | null;

  @Column({
    name: 'kyc_face_path',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Path to face photo for KYC',
  })
  kycFacePath!: string | null;

  @Column({
    name: 'kyc_status',
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
    comment: 'KYC verification status',
  })
  @Index()
  kycStatus!: KycStatus;

  // Wallet Field
  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    unique: true,
    nullable: true,
    comment: 'Ethereum Address',
  })
  walletAddress!: string | null;

  // Status Management
  @Column({
    name: 'ussd_status',
    type: 'enum',
    enum: USSDStatus,
    default: USSDStatus.NOT_APPLICABLE,
    comment: 'USSD activation status',
  })
  @Index()
  ussdStatus!: USSDStatus;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'User activation status',
  })
  isActive!: boolean;

  @Column({
    name: 'has_custody_wallet',
    type: 'boolean',
    default: false,
    comment: 'Whether user has custody wallet',
  })
  hasCustodyWallet!: boolean;

  // Metadata
  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 36,
    comment: 'Registrar Admin ID (UUID)',
  })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
