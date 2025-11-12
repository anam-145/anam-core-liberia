import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AdminRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  APPROVER = 'APPROVER',
  VERIFIER = 'VERIFIER',
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
  @Index()
  adminId!: string;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    comment: 'Admin username (unique)',
  })
  @Index()
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
    comment: 'SYSTEM_ADMIN, APPROVER, or VERIFIER',
  })
  @Index()
  role!: AdminRole;

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
  @Index()
  walletAddress!: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Account active status',
  })
  isActive!: boolean;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Creator Admin ID (UUID)',
  })
  createdBy!: string | null;

  @Column({
    name: 'last_login',
    type: 'timestamp',
    nullable: true,
    comment: 'Last login timestamp',
  })
  lastLogin!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
