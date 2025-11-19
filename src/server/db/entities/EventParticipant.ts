import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('event_participants')
export class EventParticipant {
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
    name: 'assigned_at',
    type: 'timestamp',
    comment: 'Participant assignment timestamp',
  })
  assignedAt!: Date;

  @Column({
    name: 'assigned_by_admin_id',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Admin ID (UUID) who assigned the participant',
  })
  @Index()
  assignedByAdminId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
