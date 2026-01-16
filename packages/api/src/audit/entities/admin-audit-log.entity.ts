import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Jail } from '../../auth/entities/jail.entity';

@Entity('admin_audit_log')
@Index(['jailId', 'timestamp'])
@Index(['action', 'timestamp'])
@Index(['resourceType', 'resourceId', 'timestamp'])
@Index(['timestamp'])
@Index(['severity', 'timestamp'], { where: "severity IN ('warning', 'critical')" })
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ type: 'uuid', nullable: true, name: 'jail_id' })
  jailId?: string;

  @ManyToOne(() => Jail, { nullable: true })
  @JoinColumn({ name: 'jail_id' })
  jail?: Jail;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'uuid', nullable: true, name: 'resource_id' })
  resourceId?: string;

  @Column({ type: 'inet', name: 'ip_address' })
  ipAddress!: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'request_method' })
  requestMethod?: string;

  @Column({ type: 'text', nullable: true, name: 'request_path' })
  requestPath?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'request_body' })
  requestBody?: any;

  @Column({ type: 'integer', nullable: true, name: 'response_status' })
  responseStatus?: number;

  @Column({ type: 'jsonb', nullable: true, name: 'old_values' })
  oldValues?: any;

  @Column({ type: 'jsonb', nullable: true, name: 'new_values' })
  newValues?: any;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'boolean', default: false, name: 'approval_required' })
  approvalRequired!: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'approved_at' })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'hash_chain' })
  hashChain?: string;

  @Column({ type: 'text', nullable: true, name: 'previous_hash' })
  previousHash?: string;

  @Column({ type: 'text', nullable: true })
  signature?: string;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  severity!: 'info' | 'warning' | 'critical';

  @Column({ type: 'uuid', nullable: true, name: 'session_id' })
  sessionId?: string;

  @Column({ type: 'uuid', nullable: true, name: 'correlation_id' })
  correlationId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;
}
