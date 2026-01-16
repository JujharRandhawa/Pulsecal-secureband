import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VitalMetric } from './vital-metric.entity';
import { LocationMetric } from './location-metric.entity';
import { DeviceStatus } from './device-status.entity';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  serialNumber: string;

  @Column({ type: 'varchar', length: 17, unique: true })
  macAddress: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  firmwareVersion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  hardwareVersion: string | null;

  @Column({ type: 'date', nullable: true })
  manufacturedDate: Date | null;

  @Column({ type: 'date', nullable: true })
  deployedDate: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'inventory' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => VitalMetric, (metric) => metric.device)
  vitalMetrics: VitalMetric[];

  @OneToMany(() => LocationMetric, (metric) => metric.device)
  locationMetrics: LocationMetric[];

  @OneToMany(() => DeviceStatus, (status) => status.device)
  deviceStatuses: DeviceStatus[];
}
