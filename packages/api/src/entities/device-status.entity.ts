import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('device_status')
@Index(['deviceId', 'recordedAt'])
@Index(['recordedAt'])
export class DeviceStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'uuid', name: 'gateway_id', nullable: true })
  gatewayId: string | null;

  @Column({ type: 'timestamptz', name: 'recorded_at' })
  @Index()
  recordedAt: Date;

  @Column({ type: 'varchar', length: 50 })
  connectionStatus: string;

  @Column({ type: 'integer', nullable: true })
  batteryLevel: number | null;

  @Column({ type: 'integer', nullable: true })
  signalStrength: number | null;

  @Column({ type: 'jsonb', nullable: true })
  systemStatus: Record<string, any> | null;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
