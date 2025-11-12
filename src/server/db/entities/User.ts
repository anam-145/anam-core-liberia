import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum WalletType {
  ANAMWALLET = 'ANAMWALLET',
  USSD = 'USSD',
  PAPER_VOUCHER = 'PAPER_VOUCHER',
}

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

export enum UserStatus {
  PENDING_KYC = 'PENDING_KYC',
  PENDING_USSD = 'PENDING_USSD',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
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
  @Index()
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

  @Column({
    name: 'kyc_verified_by',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Verifier Admin ID (UUID)',
  })
  kycVerifiedBy!: string | null;

  @Column({
    name: 'wallet_type',
    type: 'enum',
    enum: WalletType,
    comment: 'ANAMWALLET, USSD, or PAPER_VOUCHER',
  })
  @Index()
  walletType!: WalletType;

  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    unique: true,
    nullable: true,
    comment: 'Ethereum Address',
  })
  @Index()
  walletAddress!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'DID identifier',
  })
  @Index()
  did!: string | null;

  @Column({
    name: 'vc_id',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'KYC VC ID',
  })
  @Index()
  vcId!: string | null;

  @Column({
    name: 'user_status',
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_KYC,
    comment: 'User status',
  })
  @Index()
  userStatus!: UserStatus;

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
