import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Vault } from '@/utils/crypto/vault';
import { User } from './User';
import { Admin } from './Admin';

// Encrypted VC payload: VC JSON encrypted with AES-GCM + plain vc.id for indexing
type EncryptedVC = Vault & { id: string };

@Entity('custody_wallets')
export class CustodyWallet {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({
    name: 'custody_id',
    type: 'varchar',
    length: 50,
    unique: true,
    comment: 'Custody unique ID',
  })
  custodyId!: string;

  @Column({
    name: 'user_id',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'User ID (UUID) — nullable, either user_id or admin_id must be set',
  })
  @Index()
  @Index('UQ_custody_user_id', { unique: true })
  userId!: string | null;

  @Column({
    name: 'admin_id',
    type: 'varchar',
    length: 36,
    nullable: true,
    comment: 'Owner Admin ID (UUID) — nullable, either admin_id or user_id must be set',
  })
  @Index()
  @Index('UQ_custody_admin_id', { unique: true })
  adminId!: string | null;

  // Relations (DB-level foreign keys)
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  user?: User | null;

  @ManyToOne(() => Admin, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admin_id', referencedColumnName: 'adminId' })
  admin?: Admin | null;

  // wallet_type removed — wallet type is managed at User/Admin level, not in custody

  @Column({
    type: 'json',
    comment: 'Encrypted vault (ciphertext, iv, salt, authTag)',
  })
  vault!: Vault;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Encrypted VC vault (ciphertext, iv, salt, authTag) with plain id',
  })
  vc!: EncryptedVC | null;

  // is_backup removed — backup handling is out of scope for MVP

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
