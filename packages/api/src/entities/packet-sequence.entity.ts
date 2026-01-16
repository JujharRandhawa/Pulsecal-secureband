/**
 * Entity for tracking packet sequences to detect missing or delayed packets.
 * 
 * This enables:
 * - Detection of missing packets (gaps in sequence)
 * - Detection of delayed packets (out-of-order arrival)
 * - Data integrity verification
 * - Network quality monitoring
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

export enum PacketStatus {
  RECEIVED = 'received',
  MISSING = 'missing',      // Gap detected, packet never arrived
  DELAYED = 'delayed',      // Arrived out of order
  DUPLICATE = 'duplicate',  // Same sequence number received twice
}

@Entity('packet_sequences')
@Index(['deviceId', 'sequenceNumber'], { unique: true })
@Index(['deviceId', 'recordedAt'])
@Index(['status'])
export class PacketSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'device_id' })
  deviceId: string;

  @Column({ type: 'bigint', name: 'sequence_number' })
  sequenceNumber: number;

  @Column({ type: 'timestamptz', name: 'recorded_at' })
  recordedAt: Date;

  @Column({ type: 'timestamptz', name: 'received_at' })
  receivedAt: Date;

  @Column({
    type: 'enum',
    enum: PacketStatus,
    default: PacketStatus.RECEIVED,
  })
  status: PacketStatus;

  @Column({ type: 'integer', nullable: true, name: 'expected_sequence' })
  expectedSequence: number | null; // What sequence number was expected

  @Column({ type: 'integer', nullable: true, name: 'delay_ms' })
  delayMs: number | null; // Delay in milliseconds if delayed

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null; // Additional packet metadata

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
