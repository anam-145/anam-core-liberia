import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

export enum EventRole {
  APPROVER = 'APPROVER',
  VERIFIER = 'VERIFIER',
}

export enum EventStaffStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Entity('event_staff')
@Unique(['eventId', 'adminId']) // 같은 이벤트에 같은 관리자 중복 배정 방지
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
    type: 'enum',
    enum: EventStaffStatus,
    default: EventStaffStatus.ACTIVE,
    comment: 'Staff status for this event (ACTIVE or SUSPENDED)',
  })
  status!: EventStaffStatus;

  @Column({
    name: 'assigned_by',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Admin ID who assigned this staff (UUID)',
  })
  assignedBy!: string | null;

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
