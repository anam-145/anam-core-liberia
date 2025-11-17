import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EventStatus {
  PENDING = 'PENDING',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
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
    name: 'amount_per_day',
    type: 'decimal',
    precision: 12,
    scale: 6,
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
    name: 'is_active',
    type: 'boolean',
    default: false,
    comment: 'Event active status (default: inactive)',
  })
  isActive!: boolean;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.PENDING,
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
