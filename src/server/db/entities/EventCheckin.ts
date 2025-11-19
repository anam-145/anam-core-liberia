import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('event_checkins')
export class EventCheckin {
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
    name: 'checked_in_at',
    type: 'timestamp',
    comment: 'Check-in timestamp',
  })
  @Index()
  checkedInAt!: Date;

  @Column({
    name: 'checked_in_by_admin_id',
    type: 'varchar',
    length: 36,
    comment: 'Admin ID who performed check-in (UUID)',
  })
  @Index()
  checkedInByAdminId!: string;

  @Column({
    name: 'checkin_tx_hash',
    type: 'varchar',
    length: 66,
    nullable: true,
    comment: 'On-chain check-in transaction hash (if recorded)',
  })
  checkinTxHash!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
