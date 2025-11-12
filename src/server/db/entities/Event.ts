import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EventType {
  WORKSHOP = 'WORKSHOP',
  TRAINING = 'TRAINING',
  DISTRIBUTION = 'DISTRIBUTION',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TokenType {
  CUSTOM_ERC20 = 'CUSTOM_ERC20',
  USDC = 'USDC',
  USDT = 'USDT',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'event_id',
    type: 'varchar',
    length: 36,
    unique: true,
    comment: 'UUID unique identifier',
  })
  @Index()
  eventId!: string;

  @Column({
    name: 'event_name',
    type: 'varchar',
    length: 255,
    comment: 'Event name',
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Event description',
  })
  description!: string | null;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: EventType,
    nullable: true,
    comment: 'WORKSHOP, TRAINING, or DISTRIBUTION',
  })
  eventType!: EventType | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'Event location',
  })
  location!: string | null;

  @Column({
    name: 'start_date',
    type: 'date',
    comment: 'Event start date',
  })
  @Index()
  startDate!: Date;

  @Column({
    name: 'end_date',
    type: 'date',
    comment: 'Event end date',
  })
  endDate!: Date;

  @Column({
    name: 'token_type',
    type: 'enum',
    enum: TokenType,
    comment: 'CUSTOM_ERC20, USDC, or USDT',
  })
  tokenType!: TokenType;

  @Column({
    name: 'token_address',
    type: 'varchar',
    length: 42,
    comment: 'Token Contract Address',
  })
  tokenAddress!: string;

  @Column({
    name: 'amount_per_day',
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: 'Daily DSA Amount',
  })
  amountPerDay!: string;

  @Column({
    name: 'max_participants',
    type: 'int',
    default: 100,
    comment: 'Maximum number of participants',
  })
  maxParticipants!: number;

  @Column({
    name: 'event_contract_address',
    type: 'varchar',
    length: 42,
    unique: true,
    nullable: true,
    comment: 'Event Contract Address',
  })
  @Index()
  eventContractAddress!: string | null;

  @Column({
    name: 'deployment_tx_hash',
    type: 'varchar',
    length: 66,
    nullable: true,
    comment: 'Deployment TX Hash',
  })
  deploymentTxHash!: string | null;

  @Column({
    name: 'registration_deadline',
    type: 'timestamp',
    nullable: true,
    comment: 'Registration deadline (deprecated, for backward compatibility)',
  })
  registrationDeadline!: Date | null;

  @Column({
    name: 'payment_required',
    type: 'boolean',
    default: false,
    comment: 'Whether payment is required (deprecated, for backward compatibility)',
  })
  paymentRequired!: boolean;

  @Column({
    name: 'payment_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Payment amount (deprecated, for backward compatibility)',
  })
  paymentAmount!: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Event active status',
  })
  isActive!: boolean;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
    comment: 'Event status (for admin UI)',
  })
  @Index()
  status!: EventStatus;

  @Column({
    name: 'created_by',
    type: 'varchar',
    length: 36,
    comment: 'Creator Admin ID (UUID)',
  })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
