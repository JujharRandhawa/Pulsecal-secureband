import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('location_metrics')
@Index(['deviceId', 'recordedAt'])
@Index(['recordedAt'])
export class LocationMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'uuid', name: 'inmate_device_id', nullable: true })
  inmateDeviceId: string | null;

  @Column({ type: 'timestamptz', name: 'recorded_at' })
  @Index()
  recordedAt: Date;

  @Column({ type: 'uuid', name: 'zone_id', nullable: true })
  zoneId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  xCoordinate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  yCoordinate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  zCoordinate: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  accuracyMeters: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  locationMethod: string | null;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
