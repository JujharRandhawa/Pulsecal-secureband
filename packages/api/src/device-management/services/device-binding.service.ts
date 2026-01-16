/**
 * Service for binding/unbinding devices to inmates with automatic streaming.
 * 
 * Security: All operations verify jail ownership before proceeding.
 */

import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { InmateDevice, InmateDeviceStatus } from '../../entities/inmate-device.entity';
import { SecureBand, SecureBandStatus } from '../../secureband/entities/secureband.entity';
import { DeviceStreamingService } from './device-streaming.service';
import { DeviceHealthMonitor } from './device-health-monitor.service';

export interface BindDeviceInput {
  inmateId: string;
  deviceId: string;
  jailId: string;  // Required for ownership verification
  assignmentReason?: string;
}

export interface UnbindDeviceInput {
  inmateDeviceId: string;
  jailId: string;  // Required for ownership verification
  reason?: string;
}

@Injectable()
export class DeviceBindingService {
  private readonly logger = new Logger(DeviceBindingService.name);

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(InmateDevice)
    private inmateDeviceRepository: Repository<InmateDevice>,
    @InjectRepository(SecureBand)
    private secureBandRepository: Repository<SecureBand>,
    private deviceStreamingService: DeviceStreamingService,
    private deviceHealthMonitor: DeviceHealthMonitor,
    private dataSource: DataSource,
  ) {}

  /**
   * Verify that a device belongs to the specified jail.
   * Throws ForbiddenException if ownership check fails.
   */
  private async verifyDeviceOwnership(deviceId: string, jailId: string): Promise<SecureBand> {
    // Look up the SecureBand to verify jail ownership
    const secureBand = await this.secureBandRepository.findOne({
      where: { id: deviceId, jailId },
    });

    if (!secureBand) {
      // Try finding by device reference if the ID is from Device table
      const device = await this.deviceRepository.findOne({
        where: { id: deviceId },
      });
      
      if (device) {
        // Check if there's a SecureBand with matching serial number
        const linkedBand = await this.secureBandRepository.findOne({
          where: { deviceUid: device.serialNumber, jailId },
        });
        
        if (linkedBand) {
          return linkedBand;
        }
      }
      
      throw new ForbiddenException(
        'Access denied: Device does not belong to your facility or does not exist',
      );
    }

    // Verify device is not revoked
    if (secureBand.status === SecureBandStatus.REVOKED) {
      throw new ForbiddenException(
        'Device has been revoked and cannot be bound to inmates',
      );
    }

    return secureBand;
  }

  /**
   * Verify that an assignment belongs to the specified jail.
   */
  private async verifyAssignmentOwnership(inmateDeviceId: string, jailId: string): Promise<InmateDevice> {
    const assignment = await this.inmateDeviceRepository.findOne({
      where: { id: inmateDeviceId },
      relations: ['device'],
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment ${inmateDeviceId} not found`);
    }

    // Verify the device belongs to this jail
    await this.verifyDeviceOwnership(assignment.deviceId, jailId);

    return assignment;
  }

  /**
   * Bind device to inmate and start automatic streaming.
   * Verifies jail ownership before binding.
   */
  async bindDevice(input: BindDeviceInput): Promise<InmateDevice> {
    // Verify ownership first
    const secureBand = await this.verifyDeviceOwnership(input.deviceId, input.jailId);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if device exists and is available
      const device = await this.deviceRepository.findOne({
        where: { id: input.deviceId },
      });

      if (!device) {
        throw new NotFoundException(`Device ${input.deviceId} not found`);
      }

      // Check for existing active assignment
      const existingAssignment = await this.inmateDeviceRepository.findOne({
        where: {
          deviceId: input.deviceId,
          status: InmateDeviceStatus.ASSIGNED,
        },
      });

      if (existingAssignment) {
        throw new ForbiddenException(
          `Device ${input.deviceId} is already assigned to another inmate`,
        );
      }

      // Create assignment
      const assignment = this.inmateDeviceRepository.create({
        inmateId: input.inmateId,
        deviceId: input.deviceId,
        assignedDate: new Date(),
        assignmentReason: input.assignmentReason || null,
        status: InmateDeviceStatus.ASSIGNED,
        isStreaming: false,
      });

      const savedAssignment = await queryRunner.manager.save(assignment);

      // Update device status to active
      device.status = 'active';
      device.lastSeenAt = new Date();
      await queryRunner.manager.save(device);

      await queryRunner.commitTransaction();

      // Start automatic streaming (non-blocking)
      this.startStreaming(savedAssignment.id, input.jailId).catch((error) => {
        this.logger.error(
          `Failed to start streaming for assignment ${savedAssignment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });

      this.logger.log(
        `Device ${input.deviceId} bound to inmate ${input.inmateId} in jail ${input.jailId}, streaming started`,
      );

      return savedAssignment;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Unbind device from inmate and stop streaming.
   * Verifies jail ownership before unbinding.
   */
  async unbindDevice(input: UnbindDeviceInput): Promise<void> {
    // Verify ownership first
    const assignment = await this.verifyAssignmentOwnership(input.inmateDeviceId, input.jailId);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Stop streaming
      if (assignment.isStreaming) {
        await this.stopStreaming(assignment.id);
      }

      // Update assignment
      assignment.status = InmateDeviceStatus.UNASSIGNED;
      assignment.unassignedDate = new Date();
      assignment.isStreaming = false;
      assignment.streamingStoppedAt = new Date();

      await queryRunner.manager.save(assignment);

      // Update device status
      if (assignment.device) {
        assignment.device.status = 'inventory';
        await queryRunner.manager.save(assignment.device);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Device ${assignment.deviceId} unbound from inmate ${assignment.inmateId}, streaming stopped`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Start streaming for a device assignment.
   */
  private async startStreaming(inmateDeviceId: string, jailId: string): Promise<void> {
    const assignment = await this.inmateDeviceRepository.findOne({
      where: { id: inmateDeviceId },
      relations: ['device'],
    });

    if (!assignment || assignment.status !== InmateDeviceStatus.ASSIGNED) {
      throw new Error(`Invalid assignment ${inmateDeviceId} for streaming`);
    }

    // Mark as streaming
    assignment.isStreaming = true;
    assignment.streamingStartedAt = new Date();
    await this.inmateDeviceRepository.save(assignment);

    // Register with streaming service (include jailId)
    await this.deviceStreamingService.startStreaming({
      deviceId: assignment.deviceId,
      inmateDeviceId: assignment.id,
      deviceSerial: assignment.device.serialNumber,
      jailId,
    });

    // Register with health monitor
    this.deviceHealthMonitor.registerDevice(assignment.deviceId);

    this.logger.log(
      `Streaming started for device ${assignment.deviceId} (assignment: ${inmateDeviceId})`,
    );
  }

  /**
   * Stop streaming for a device assignment.
   */
  private async stopStreaming(inmateDeviceId: string): Promise<void> {
    const assignment = await this.inmateDeviceRepository.findOne({
      where: { id: inmateDeviceId },
    });

    if (!assignment) {
      return;
    }

    // Stop streaming service
    await this.deviceStreamingService.stopStreaming(assignment.deviceId);

    // Unregister from health monitor
    this.deviceHealthMonitor.unregisterDevice(assignment.deviceId);

    // Update assignment
    assignment.isStreaming = false;
    assignment.streamingStoppedAt = new Date();
    await this.inmateDeviceRepository.save(assignment);

    this.logger.log(
      `Streaming stopped for device ${assignment.deviceId} (assignment: ${inmateDeviceId})`,
    );
  }

  /**
   * Handle device reconnection (called when device sends data after being offline).
   * This is called from device-authenticated endpoints, so jail verification happens there.
   */
  async handleReconnection(deviceId: string, jailId: string): Promise<void> {
    const assignment = await this.inmateDeviceRepository.findOne({
      where: {
        deviceId,
        status: InmateDeviceStatus.ASSIGNED,
      },
      relations: ['device'],
    });

    if (!assignment) {
      this.logger.debug(`No active assignment found for device ${deviceId}`);
      return;
    }

    // If not streaming, start it
    if (!assignment.isStreaming) {
      await this.startStreaming(assignment.id, jailId);
      this.logger.log(`Reconnected device ${deviceId}, streaming resumed`);
    } else {
      // Update last seen
      if (assignment.device) {
        assignment.device.lastSeenAt = new Date();
        await this.deviceRepository.save(assignment.device);
      }
      this.deviceHealthMonitor.updateLastSeen(deviceId);
      this.logger.debug(`Device ${deviceId} reconnected, streaming active`);
    }
  }
}
