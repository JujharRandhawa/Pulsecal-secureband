import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('alerts')
@Index(['deviceId', 'triggeredAt'])
@Index(['status', 'triggeredAt'])
@Index(['severity', 'triggeredAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'inmate_device_id', nullable: true })
  inmateDeviceId: string | null;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'varchar', length: 100, name: 'alert_type' })
  @Index()
  alertType: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  @Index()
  severity: string;

  @Column({ type: 'varchar', length: 50, default: 'open' })
  @Index()
  status: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true, name: 'explanation' })
  explanation: string | null; // Why the alert triggered (explainable output)

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'confidence' })
  confidence: number | null; // Confidence score (0-1) for the alert

  @Column({ type: 'jsonb', nullable: true })
  alertData: Record<string, any> | null;

  @Column({ type: 'timestamptz', name: 'triggered_at', default: () => 'NOW()' })
  @Index()
  triggeredAt: Date;

  @Column({ type: 'timestamptz', name: 'acknowledged_at', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'uuid', name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', name: 'resolved_by', nullable: true })
  resolvedBy: string | null;

  @Column({ type: 'text', name: 'resolution_notes', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
