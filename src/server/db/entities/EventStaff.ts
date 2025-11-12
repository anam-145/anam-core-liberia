import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum EventRole {
  APPROVER = 'APPROVER',
  VERIFIER = 'VERIFIER',
}

@Entity('event_staff')
export class EventStaff {
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
    name: 'admin_id',
    type: 'varchar',
    length: 36,
    comment: 'Admin ID (UUID)',
  })
  @Index()
  adminId!: string;

  @Column({
    name: 'event_role',
    type: 'enum',
    enum: EventRole,
    comment: 'APPROVER or VERIFIER',
  })
  eventRole!: EventRole;

  @Column({
    name: 'assigned_at',
    type: 'timestamp',
    comment: 'Staff assignment timestamp',
  })
  assignedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
