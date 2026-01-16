import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('vital_metrics')
@Index(['deviceId', 'recordedAt'], { order: { recordedAt: 'DESC' } })
@Index(['recordedAt'], { order: { recordedAt: 'DESC' } })
export class VitalMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'uuid', name: 'inmate_device_id', nullable: true })
  inmateDeviceId: string | null;

  @Column({ type: 'timestamptz', name: 'recorded_at' })
  @Index()
  recordedAt: Date;

  @Column({ type: 'integer', nullable: true })
  heartRate: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  temperatureCelsius: number | null;

  @Column({ type: 'integer', nullable: true })
  oxygenSaturation: number | null;

  @Column({ type: 'integer', nullable: true })
  bloodPressureSystolic: number | null;

  @Column({ type: 'integer', nullable: true })
  bloodPressureDiastolic: number | null;

  @Column({ type: 'integer', nullable: true })
  batteryLevel: number | null;

  @Column({ type: 'integer', nullable: true })
  signalStrength: number | null;

  @Column({ type: 'jsonb', nullable: true })
  additionalMetrics: Record<string, any> | null;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
