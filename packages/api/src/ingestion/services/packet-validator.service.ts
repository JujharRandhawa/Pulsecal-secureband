/**
 * Service for validating incoming data packets.
 * 
 * Responsibilities:
 * - Validate packet structure and required fields
 * - Check data ranges and types
 * - Verify device authentication
 * - Validate timestamps (detect clock skew, future dates)
 * - Track packet sequences for missing/delayed detection
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { PacketSequence, PacketStatus } from '../../entities/packet-sequence.entity';
import { Device } from '../../entities/device.entity';

export interface PacketValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  correctedTimestamp?: Date;
  sequenceStatus?: PacketStatus;
  missingSequences?: number[];
}

export interface PacketMetadata {
  deviceId: string;
  deviceSerial: string;
  sequenceNumber?: number;
  recordedAt: Date;
  receivedAt: Date;
  packetType: 'vital' | 'location' | 'status';
}

@Injectable()
export class PacketValidatorService {
  private readonly logger = new Logger(PacketValidatorService.name);
  
  // Configuration
  private readonly MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_FUTURE_TIMESTAMP_MS = 60 * 1000; // 1 minute
  private readonly MAX_SEQUENCE_GAP = 100; // Alert if gap > 100 packets
  private readonly SEQUENCE_WINDOW_SIZE = 1000; // Track last 1000 sequences per device

  // In-memory tracking for fast sequence checks
  private readonly deviceSequences = new Map<string, {
    lastSequence: number;
    receivedSequences: Set<number>;
    lastCleanup: Date;
  }>();

  constructor(
    @InjectRepository(PacketSequence)
    private packetSequenceRepository: Repository<PacketSequence>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {
    // Cleanup old in-memory sequences periodically
    setInterval(() => this.cleanupMemorySequences(), 60 * 1000); // Every minute
  }

  /**
   * Validate a data packet.
   */
  async validatePacket(metadata: PacketMetadata, data: Record<string, any>): Promise<PacketValidationResult> {
    const result: PacketValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // 1. Validate device exists and is active
    await this.validateDevice(metadata.deviceId, result);

    // 2. Validate timestamp
    await this.validateTimestamp(metadata, result);

    // 3. Validate packet sequence (if provided)
    if (metadata.sequenceNumber !== undefined) {
      await this.validateSequence(metadata, result);
    }

    // 4. Validate data ranges based on packet type
    this.validateDataRanges(metadata.packetType, data, result);

    // Final validation
    result.valid = result.errors.length === 0;

    return result;
  }

  /**
   * Validate device exists and is active.
   */
  private async validateDevice(deviceId: string, result: PacketValidationResult): Promise<void> {
    try {
      const device = await this.deviceRepository.findOne({
        where: { id: deviceId },
      });

      if (!device) {
        result.errors.push(`Device ${deviceId} not found`);
        result.valid = false;
        return;
      }

      if (device.status === 'revoked') {
        result.errors.push(`Device ${deviceId} has been revoked`);
        result.valid = false;
        return;
      }

      if (device.status !== 'active' && device.status !== 'inventory') {
        result.warnings.push(`Device ${deviceId} is in ${device.status} status`);
      }
    } catch (error) {
      result.errors.push(`Failed to validate device: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
    }
  }

  /**
   * Validate and correct timestamp.
   */
  private async validateTimestamp(metadata: PacketMetadata, result: PacketValidationResult): Promise<void> {
    const now = new Date();
    const recordedAt = metadata.recordedAt;
    const receivedAt = metadata.receivedAt;

    // Check for future timestamps (clock skew or malicious data)
    const futureDrift = recordedAt.getTime() - now.getTime();
    if (futureDrift > this.MAX_FUTURE_TIMESTAMP_MS) {
      result.warnings.push(
        `Timestamp is ${Math.round(futureDrift / 1000)}s in the future, using server time`,
      );
      result.correctedTimestamp = now;
      return;
    }

    // Check for excessive past timestamps (delayed packets)
    const pastDrift = now.getTime() - recordedAt.getTime();
    if (pastDrift > this.MAX_TIMESTAMP_DRIFT_MS) {
      result.warnings.push(
        `Timestamp is ${Math.round(pastDrift / 1000 / 60)} minutes old, may be delayed packet`,
      );
      // Keep original timestamp but flag as potentially delayed
    }

    // Check for network delay
    const networkDelay = receivedAt.getTime() - recordedAt.getTime();
    if (networkDelay > 10 * 1000) { // More than 10 seconds
      result.warnings.push(
        `Network delay detected: ${Math.round(networkDelay / 1000)}s between recording and receipt`,
      );
    }

    // Use original timestamp if no correction needed
    if (!result.correctedTimestamp) {
      result.correctedTimestamp = recordedAt;
    }
  }

  /**
   * Validate packet sequence number.
   */
  private async validateSequence(metadata: PacketMetadata, result: PacketValidationResult): Promise<void> {
    const { deviceId, sequenceNumber } = metadata;

    // Get or initialize device sequence tracking
    let deviceSeq = this.deviceSequences.get(deviceId);
    if (!deviceSeq) {
      deviceSeq = {
        lastSequence: 0,
        receivedSequences: new Set(),
        lastCleanup: new Date(),
      };
      this.deviceSequences.set(deviceId, deviceSeq);
    }

    // Skip sequence validation if sequenceNumber is not provided
    if (sequenceNumber === undefined) {
      return;
    }

    // Check for duplicate
    if (deviceSeq.receivedSequences.has(sequenceNumber)) {
      result.sequenceStatus = PacketStatus.DUPLICATE;
      result.warnings.push(`Duplicate packet detected: sequence ${sequenceNumber}`);
      
      // Still record it for tracking
      await this.recordPacketSequence(metadata, PacketStatus.DUPLICATE);
      return;
    }

    // Check for out-of-order (delayed)
    if (sequenceNumber < deviceSeq.lastSequence) {
      result.sequenceStatus = PacketStatus.DELAYED;
      const delay = deviceSeq.lastSequence - sequenceNumber;
      result.warnings.push(`Out-of-order packet: sequence ${sequenceNumber} (expected > ${deviceSeq.lastSequence})`);
      
      await this.recordPacketSequence(metadata, PacketStatus.DELAYED, {
        expectedSequence: deviceSeq.lastSequence + 1,
        delayMs: delay,
      });
    }

    // Check for gaps (missing packets)
    if (sequenceNumber > deviceSeq.lastSequence + 1) {
      const gap = sequenceNumber - deviceSeq.lastSequence - 1;
      result.sequenceStatus = PacketStatus.MISSING;
      result.missingSequences = [];

      for (let i = deviceSeq.lastSequence + 1; i < sequenceNumber; i++) {
        result.missingSequences.push(i);
      }

      if (gap <= 10) {
        result.warnings.push(`Missing ${gap} packet(s): sequences ${deviceSeq.lastSequence + 1} to ${sequenceNumber - 1}`);
      } else {
        result.warnings.push(`Large gap detected: ${gap} missing packets (sequences ${deviceSeq.lastSequence + 1} to ${sequenceNumber - 1})`);
        
        // Alert if gap is very large
        if (gap > this.MAX_SEQUENCE_GAP) {
          this.logger.warn(
            `CRITICAL: Device ${metadata.deviceSerial} has gap of ${gap} packets (${deviceSeq.lastSequence + 1} to ${sequenceNumber - 1})`,
          );
        }
      }

      // Record missing sequences
      for (const missingSeq of result.missingSequences) {
        await this.recordPacketSequence(
          {
            ...metadata,
            sequenceNumber: missingSeq,
            recordedAt: new Date(metadata.recordedAt.getTime() - (sequenceNumber - missingSeq) * 1000), // Estimate timestamp
          },
          PacketStatus.MISSING,
        );
      }
    }

    // Update tracking
    deviceSeq.receivedSequences.add(sequenceNumber);
    if (sequenceNumber > deviceSeq.lastSequence) {
      deviceSeq.lastSequence = sequenceNumber;
    }

    // Record this packet
    if (result.sequenceStatus !== PacketStatus.DUPLICATE) {
      await this.recordPacketSequence(metadata, result.sequenceStatus || PacketStatus.RECEIVED);
    }

    // Cleanup old sequences from memory (keep only recent window)
    this.cleanupDeviceSequences(deviceId, deviceSeq);
  }

  /**
   * Record packet sequence in database.
   */
  private async recordPacketSequence(
    metadata: PacketMetadata,
    status: PacketStatus,
    additionalData?: { expectedSequence?: number; delayMs?: number },
  ): Promise<void> {
    try {
      if (metadata.sequenceNumber === undefined) {
        return; // No sequence tracking for this packet
      }

      const packetSeq = this.packetSequenceRepository.create({
        deviceId: metadata.deviceId,
        sequenceNumber: metadata.sequenceNumber,
        recordedAt: metadata.recordedAt,
        receivedAt: metadata.receivedAt,
        status,
        expectedSequence: additionalData?.expectedSequence ?? null,
        delayMs: additionalData?.delayMs ?? null,
        metadata: {
          packetType: metadata.packetType,
          deviceSerial: metadata.deviceSerial,
        },
      });

      await this.packetSequenceRepository.save(packetSeq);
    } catch (error) {
      // Don't fail validation if sequence tracking fails
      this.logger.warn(
        `Failed to record packet sequence: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate data ranges based on packet type.
   */
  private validateDataRanges(
    packetType: string,
    data: Record<string, any>,
    result: PacketValidationResult,
  ): void {
    if (packetType === 'vital') {
      // Heart rate validation
      if (data.heartRate !== null && data.heartRate !== undefined) {
        if (data.heartRate < 0 || data.heartRate > 250) {
          result.errors.push(`Invalid heart rate: ${data.heartRate} (expected 0-250)`);
        }
      }

      // Temperature validation
      if (data.temperatureCelsius !== null && data.temperatureCelsius !== undefined) {
        if (data.temperatureCelsius < 30 || data.temperatureCelsius > 45) {
          result.warnings.push(`Unusual temperature: ${data.temperatureCelsius}°C (expected 30-45°C)`);
        }
      }

      // Oxygen saturation validation
      if (data.oxygenSaturation !== null && data.oxygenSaturation !== undefined) {
        if (data.oxygenSaturation < 0 || data.oxygenSaturation > 100) {
          result.errors.push(`Invalid oxygen saturation: ${data.oxygenSaturation} (expected 0-100)`);
        }
      }

      // Blood pressure validation
      if (data.bloodPressureSystolic !== null && data.bloodPressureSystolic !== undefined) {
        if (data.bloodPressureSystolic < 50 || data.bloodPressureSystolic > 250) {
          result.warnings.push(`Unusual systolic BP: ${data.bloodPressureSystolic} (expected 50-250)`);
        }
      }

      if (data.bloodPressureDiastolic !== null && data.bloodPressureDiastolic !== undefined) {
        if (data.bloodPressureDiastolic < 30 || data.bloodPressureDiastolic > 150) {
          result.warnings.push(`Unusual diastolic BP: ${data.bloodPressureDiastolic} (expected 30-150)`);
        }
      }

      // Battery level validation
      if (data.batteryLevel !== null && data.batteryLevel !== undefined) {
        if (data.batteryLevel < 0 || data.batteryLevel > 100) {
          result.errors.push(`Invalid battery level: ${data.batteryLevel} (expected 0-100)`);
        }
      }
    } else if (packetType === 'location') {
      // Coordinate validation
      if (data.xCoordinate !== null && data.xCoordinate !== undefined) {
        if (typeof data.xCoordinate !== 'number' || !isFinite(data.xCoordinate)) {
          result.errors.push(`Invalid x coordinate: ${data.xCoordinate}`);
        }
      }

      if (data.yCoordinate !== null && data.yCoordinate !== undefined) {
        if (typeof data.yCoordinate !== 'number' || !isFinite(data.yCoordinate)) {
          result.errors.push(`Invalid y coordinate: ${data.yCoordinate}`);
        }
      }

      if (data.zCoordinate !== null && data.zCoordinate !== undefined) {
        if (typeof data.zCoordinate !== 'number' || !isFinite(data.zCoordinate)) {
          result.errors.push(`Invalid z coordinate: ${data.zCoordinate}`);
        }
      }
    }
  }

  /**
   * Cleanup old sequences from memory.
   */
  private cleanupDeviceSequences(deviceId: string, deviceSeq: { receivedSequences: Set<number>; lastSequence: number }): void {
    // Keep only sequences within the window
    const minSequence = deviceSeq.lastSequence - this.SEQUENCE_WINDOW_SIZE;
    const sequencesToRemove: number[] = [];

    for (const seq of deviceSeq.receivedSequences) {
      if (seq < minSequence) {
        sequencesToRemove.push(seq);
      }
    }

    sequencesToRemove.forEach((seq) => deviceSeq.receivedSequences.delete(seq));
  }

  /**
   * Periodic cleanup of old in-memory sequences.
   */
  private cleanupMemorySequences(): void {
    const now = new Date();
    const devicesToClean: string[] = [];

    for (const [deviceId, deviceSeq] of this.deviceSequences.entries()) {
      // Cleanup if no activity for 1 hour
      const timeSinceLastActivity = now.getTime() - deviceSeq.lastCleanup.getTime();
      if (timeSinceLastActivity > 60 * 60 * 1000) {
        devicesToClean.push(deviceId);
      }
    }

    devicesToClean.forEach((deviceId) => this.deviceSequences.delete(deviceId));
  }

  /**
   * Get missing packet statistics for a device.
   */
  async getMissingPacketsStats(deviceId: string, startTime: Date, endTime: Date): Promise<{
    totalMissing: number;
    totalDelayed: number;
    totalDuplicate: number;
    gaps: Array<{ start: number; end: number; count: number }>;
  }> {
    const missingPackets = await this.packetSequenceRepository.find({
      where: {
        deviceId,
        status: PacketStatus.MISSING,
        recordedAt: Between(startTime, endTime),
      },
      order: { sequenceNumber: 'ASC' },
    });

    const delayedPackets = await this.packetSequenceRepository.count({
      where: {
        deviceId,
        status: PacketStatus.DELAYED,
        recordedAt: Between(startTime, endTime),
      },
    });

    const duplicatePackets = await this.packetSequenceRepository.count({
      where: {
        deviceId,
        status: PacketStatus.DUPLICATE,
        recordedAt: Between(startTime, endTime),
      },
    });

    // Group missing packets into gaps
    const gaps: Array<{ start: number; end: number; count: number }> = [];
    let currentGap: { start: number; end: number; count: number } | null = null;

    for (const packet of missingPackets) {
      if (!currentGap || packet.sequenceNumber !== currentGap.end + 1) {
        if (currentGap) {
          gaps.push(currentGap);
        }
        currentGap = {
          start: packet.sequenceNumber,
          end: packet.sequenceNumber,
          count: 1,
        };
      } else {
        currentGap.end = packet.sequenceNumber;
        currentGap.count++;
      }
    }

    if (currentGap) {
      gaps.push(currentGap);
    }

    return {
      totalMissing: missingPackets.length,
      totalDelayed: delayedPackets,
      totalDuplicate: duplicatePackets,
      gaps,
    };
  }
}
