import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum PaymentMethod {
  MOBILE_MONEY = 'MOBILE_MONEY',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('event_payments')
export class EventPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'event_id',
    type: 'varchar',
    length: 36,
    comment: 'Event ID (UUID)',
  })
  @Index()
  eventId!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 36,
    comment: 'User ID (UUID)',
  })
  @Index()
  userId!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: 'Payment amount',
  })
  amount!: string;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    comment: 'MOBILE_MONEY, CASH, or BANK_TRANSFER',
  })
  paymentMethod!: PaymentMethod;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    comment: 'Payment status',
  })
  @Index()
  paymentStatus!: PaymentStatus;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'External transaction reference (e.g., mobile money transaction ID)',
  })
  transactionId!: string | null;

  @Column({
    name: 'paid_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Payment completion timestamp',
  })
  paidAt!: Date | null;

  @Column({
    name: 'verified_by',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Admin ID who verified the payment (UUID)',
  })
  verifiedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
