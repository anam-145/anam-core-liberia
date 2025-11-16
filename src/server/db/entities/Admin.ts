import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AdminRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  STAFF = 'STAFF',
}

export enum OnboardingStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
}

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'admin_id',
    type: 'varchar',
    length: 36,
    unique: true,
    comment: 'Unique Admin ID (UUID)',
  })
  adminId!: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    comment: 'Admin username (unique)',
  })
  username!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    comment: 'Bcrypt hashed password',
  })
  passwordHash!: string;

  @Column({
    name: 'full_name',
    type: 'varchar',
    length: 255,
    comment: 'Administrator full name',
  })
  fullName!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'Email address',
  })
  @Index()
  email!: string | null;

  @Column({
    name: 'phone_number',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'Phone number',
  })
  phoneNumber!: string | null;

  @Column({
    type: 'enum',
    enum: AdminRole,
    comment: 'SYSTEM_ADMIN or STAFF (event-scoped roles live in EventStaff)',
  })
  @Index()
  role!: AdminRole;

  @Column({
    name: 'onboarding_status',
    type: 'enum',
    enum: OnboardingStatus,
    default: OnboardingStatus.ACTIVE,
    comment: 'Signup/approval/activation state',
  })
  onboardingStatus!: OnboardingStatus;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'DID identifier',
  })
  did!: string | null;

  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    unique: true,
    nullable: true,
    comment: 'Ethereum Address',
  })
  walletAddress!: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Account active status',
  })
  isActive!: boolean;

  // created_by, last_login removed

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
