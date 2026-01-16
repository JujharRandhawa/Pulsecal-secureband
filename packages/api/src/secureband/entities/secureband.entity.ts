import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Jail } from '../../auth/entities/jail.entity';

export enum SecureBandStatus {
  LOCKED = 'LOCKED',
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Entity('securebands')
@Index(['deviceUid'], { unique: true })
@Index(['jailId'])
@Index(['status'])
@Index(['jailId', 'status'])
@Index(['lastSeen'], { where: "status = 'ACTIVE'" })
export class SecureBand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, name: 'device_uid' })
  deviceUid!: string;

  @Column({ type: 'uuid', name: 'jail_id' })
  jailId!: string;

  @ManyToOne(() => Jail, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jail_id' })
  jail!: Jail;

  @Column({
    type: 'enum',
    enum: SecureBandStatus,
    default: SecureBandStatus.LOCKED,
  })
  status!: SecureBandStatus;

  @Column({ type: 'timestamptz', nullable: true, name: 'bound_at' })
  boundAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_seen' })
  lastSeen?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'firmware_version' })
  firmwareVersion?: string;

  @Column({ type: 'text', nullable: true, name: 'public_key' })
  publicKey?: string;

  @Column({ type: 'uuid', nullable: true, name: 'added_by' })
  addedBy?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'added_at' })
  addedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'removed_by' })
  removedBy?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'removed_at' })
  removedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'removal_reason' })
  removalReason?: string;

  @Column({ type: 'text', nullable: true, name: 'auth_token_hash' })
  authTokenHash?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'token_issued_at' })
  tokenIssuedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'token_expires_at' })
  tokenExpiresAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'nonce_seed' })
  nonceSeed?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
