import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('event_payments')
export class EventPayment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'checkin_id',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Check-in ID (UUID, references event_checkins.checkin_id)',
  })
  @Index()
  checkinId!: string | null;

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
    name: 'payment_tx_hash',
    type: 'varchar',
    length: 66,
    nullable: true,
    comment: 'On-chain payment transaction hash (if recorded)',
  })
  paymentTxHash!: string | null;

  @Column({
    name: 'paid_at',
    type: 'timestamp',
    nullable: false,
    comment: 'Payment timestamp',
  })
  @Index()
  paidAt!: Date;

  @Column({
    name: 'paid_by_admin_id',
    type: 'varchar',
    length: 36,
    nullable: false,
    comment: 'Admin ID who approved the payment (UUID)',
  })
  @Index()
  paidByAdminId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
