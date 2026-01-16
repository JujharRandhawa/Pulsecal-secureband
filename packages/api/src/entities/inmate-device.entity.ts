/** Entity for inmate-device assignments. */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';

export enum InmateDeviceStatus {
  ASSIGNED = 'assigned',
  UNASSIGNED = 'unassigned',
  LOST = 'lost',
  DAMAGED = 'damaged',
}

@Entity('inmate_devices')
@Index(['deviceId', 'status'])
@Index(['inmateId', 'status'])
@Index(['status', 'assignedDate'])
export class InmateDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'inmate_id' })
  inmateId: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @ManyToOne(() => Device, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ type: 'date', name: 'assigned_date' })
  assignedDate: Date;

  @Column({ type: 'date', name: 'unassigned_date', nullable: true })
  unassignedDate: Date | null;

  @Column({ type: 'text', nullable: true })
  assignmentReason: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: InmateDeviceStatus.ASSIGNED,
  })
  status: InmateDeviceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  streamingStartedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  streamingStoppedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isStreaming: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
