import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import type { VerifiablePresentation } from '@/utils/crypto/did';

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
    name: 'checked_in_by',
    type: 'varchar',
    length: 36,
    comment: 'Admin ID who performed check-in (UUID)',
  })
  checkedInBy!: string;

  @Column({
    name: 'vp_data',
    type: 'json',
    nullable: true,
    comment: 'Verifiable Presentation data (if VP-based check-in)',
  })
  vpData!: VerifiablePresentation | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
