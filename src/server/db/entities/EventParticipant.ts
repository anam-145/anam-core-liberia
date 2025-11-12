import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum RegistrationStatus {
  REGISTERED = 'REGISTERED',
  WAITLIST = 'WAITLIST',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

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
    name: 'registration_status',
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.REGISTERED,
    comment: 'Registration status',
  })
  @Index()
  registrationStatus!: RegistrationStatus;

  @Column({
    name: 'registered_at',
    type: 'timestamp',
    comment: 'Registration timestamp',
  })
  registeredAt!: Date;

  @Column({
    name: 'confirmed_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Confirmation timestamp',
  })
  confirmedAt!: Date | null;

  @Column({
    name: 'cancelled_at',
    type: 'timestamp',
    nullable: true,
    comment: 'Cancellation timestamp',
  })
  cancelledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
