/**
 * Service for managing SecureBand devices.
 * 
 * Security: All operations are scoped to the authenticated jail.
 * Ownership verification is enforced on all read/write operations.
 */

import { Injectable, Logger, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { DeviceStatus } from '../../entities/device-status.entity';
import { InmateDevice } from '../../entities/inmate-device.entity';
import { SecureBand, SecureBandStatus } from '../../secureband/entities/secureband.entity';
import { CreateDeviceDto, UpdateDeviceDto, DeviceResponseDto } from '../dto';
import { AuditService } from '../../audit/audit.service';
import { Request } from 'express';

@Injectable()
export class DeviceManagementService {
  private readonly logger = new Logger(DeviceManagementService.name);

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(DeviceStatus)
    private deviceStatusRepository: Repository<DeviceStatus>,
    @InjectRepository(InmateDevice)
    private inmateDeviceRepository: Repository<InmateDevice>,
    @InjectRepository(SecureBand)
    private secureBandRepository: Repository<SecureBand>,
    private auditService: AuditService,
  ) {}

  /**
   * Verify that a device belongs to the specified jail.
   * Returns the SecureBand if found, throws ForbiddenException otherwise.
   */
  private async verifyDeviceOwnership(deviceId: string, jailId?: string): Promise<SecureBand | null> {
    if (!jailId) {
      // No jail context - system-level access (should be rare)
      return null;
    }

    // Check if device exists in SecureBand registry for this jail
    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    // Look up SecureBand by serial number
    const secureBand = await this.secureBandRepository.findOne({
      where: { deviceUid: device.serialNumber, jailId },
    });

    if (!secureBand) {
      throw new ForbiddenException(
        'Access denied: Device does not belong to your facility',
      );
    }

    return secureBand;
  }

  /**
   * List all devices with status and metadata.
   * Scoped to the authenticated jail.
   */
  async findAll(status?: string, jailId?: string): Promise<DeviceResponseDto[]> {
    let devices: Device[];

    if (jailId) {
      // Get devices that belong to this jail via SecureBand
      const secureBands = await this.secureBandRepository.find({
        where: { jailId },
      });
      const deviceUids = secureBands.map((sb) => sb.deviceUid);

      if (deviceUids.length === 0) {
        return [];
      }

      const query = this.deviceRepository
        .createQueryBuilder('device')
        .where('device.serialNumber IN (:...uids)', { uids: deviceUids });

      if (status && status !== 'all') {
        query.andWhere('device.status = :status', { status });
      }

      devices = await query.orderBy('device.createdAt', 'DESC').getMany();
    } else {
      // No jail context - return all (system-level)
      const where: any = {};
      if (status && status !== 'all') {
        where.status = status;
      }

      devices = await this.deviceRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });
    }

    // Enrich with additional data
    return Promise.all(devices.map((device) => this.enrichDeviceData(device)));
  }

  /**
   * Get device by ID.
   * Verifies ownership if jailId is provided.
   */
  async findOne(id: string, jailId?: string): Promise<DeviceResponseDto> {
    const device = await this.deviceRepository.findOne({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }

    // Verify ownership if jail context exists
    if (jailId) {
      await this.verifyDeviceOwnership(id, jailId);
    }

    return this.enrichDeviceData(device);
  }

  /**
   * Create a new device and register with jail.
   */
  async create(
    createDto: CreateDeviceDto,
    jailId: string,
    request: Request,
  ): Promise<DeviceResponseDto> {
    // Check for duplicate serial number
    const existingBySerial = await this.deviceRepository.findOne({
      where: { serialNumber: createDto.serialNumber },
    });

    if (existingBySerial) {
      throw new ConflictException(
        `Device with serial number ${createDto.serialNumber} already exists`,
      );
    }

    // Check for duplicate MAC address
    const existingByMac = await this.deviceRepository.findOne({
      where: { macAddress: createDto.macAddress },
    });

    if (existingByMac) {
      throw new ConflictException(
        `Device with MAC address ${createDto.macAddress} already exists`,
      );
    }

    const device = this.deviceRepository.create({
      serialNumber: createDto.serialNumber,
      macAddress: createDto.macAddress,
      firmwareVersion: createDto.firmwareVersion || null,
      hardwareVersion: createDto.hardwareVersion || null,
      manufacturedDate: createDto.manufacturedDate
        ? new Date(createDto.manufacturedDate)
        : null,
      deployedDate: createDto.deployedDate
        ? new Date(createDto.deployedDate)
        : null,
      status: 'inventory',
    });

    const savedDevice = await this.deviceRepository.save(device);

    // Audit log
    await this.auditService.log({
      tableName: 'devices',
      operation: 'CREATE',
      recordId: savedDevice.id,
      userId: jailId,
      newValues: {
        serialNumber: savedDevice.serialNumber,
        macAddress: savedDevice.macAddress,
        firmwareVersion: savedDevice.firmwareVersion,
        status: savedDevice.status,
        jailId,
      },
    });

    this.logger.log(`Device created: ${savedDevice.id} (${savedDevice.serialNumber}) for jail ${jailId}`);

    return this.enrichDeviceData(savedDevice);
  }

  /**
   * Update device.
   * Verifies ownership before update.
   */
  async update(
    id: string,
    updateDto: UpdateDeviceDto,
    jailId: string,
    request: Request,
  ): Promise<DeviceResponseDto> {
    const device = await this.deviceRepository.findOne({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }

    // Verify ownership
    await this.verifyDeviceOwnership(id, jailId);

    const oldValues = {
      firmwareVersion: device.firmwareVersion,
      hardwareVersion: device.hardwareVersion,
      status: device.status,
      deployedDate: device.deployedDate,
    };

    if (updateDto.firmwareVersion !== undefined) {
      device.firmwareVersion = updateDto.firmwareVersion;
    }
    if (updateDto.hardwareVersion !== undefined) {
      device.hardwareVersion = updateDto.hardwareVersion;
    }
    if (updateDto.status !== undefined) {
      device.status = updateDto.status;
    }
    if (updateDto.deployedDate !== undefined) {
      device.deployedDate = new Date(updateDto.deployedDate);
    }

    const savedDevice = await this.deviceRepository.save(device);

    // Audit log
    await this.auditService.logAction(
      {
        action: 'UPDATE_DEVICE',
        resourceType: 'device',
        resourceId: savedDevice.id,
        oldValues,
        newValues: {
          firmwareVersion: savedDevice.firmwareVersion,
          hardwareVersion: savedDevice.hardwareVersion,
          status: savedDevice.status,
          deployedDate: savedDevice.deployedDate,
        },
        severity: 'info',
      },
      request,
      jailId,
    );

    this.logger.log(`Device updated: ${savedDevice.id} by jail ${jailId}`);

    return this.enrichDeviceData(savedDevice);
  }

  /**
   * Remove (revoke) device.
   * Verifies ownership before removal.
   * Revoked devices cannot reconnect.
   */
  async remove(id: string, jailId: string, request: Request, reason?: string): Promise<void> {
    const device = await this.deviceRepository.findOne({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }

    // Verify ownership
    const secureBand = await this.verifyDeviceOwnership(id, jailId);

    // Check for active assignments
    const activeAssignment = await this.inmateDeviceRepository.findOne({
      where: {
        deviceId: id,
        status: 'assigned',
      },
    });

    if (activeAssignment) {
      throw new ConflictException(
        `Cannot remove device ${id}: Device is currently assigned to an inmate`,
      );
    }

    const oldValues = {
      serialNumber: device.serialNumber,
      macAddress: device.macAddress,
      status: device.status,
    };

    // Mark device as revoked
    device.status = 'revoked';
    await this.deviceRepository.save(device);

    // Also revoke the SecureBand to prevent reconnection
    if (secureBand) {
      secureBand.status = SecureBandStatus.REVOKED;
      secureBand.removedBy = jailId;
      secureBand.removedAt = new Date();
      secureBand.removalReason = reason || 'Device removed by admin';
      secureBand.authTokenHash = null;  // Invalidate auth token
      secureBand.tokenExpiresAt = new Date();  // Expire immediately
      await this.secureBandRepository.save(secureBand);
    }

    // Audit log (critical action)
    await this.auditService.logCriticalAction(
      {
        action: 'REMOVE_DEVICE',
        resourceType: 'device',
        resourceId: device.id,
        oldValues,
        newValues: {
          status: 'revoked',
        },
        reason: reason || 'Device removed by admin',
      },
      request,
      jailId,
    );

    this.logger.log(`Device removed: ${device.id} (${device.serialNumber}) by jail ${jailId}`);
  }

  /**
   * Enrich device data with computed fields.
   */
  private async enrichDeviceData(device: Device): Promise<DeviceResponseDto> {
    // Get latest device status (for battery, connection)
    const latestStatus = await this.deviceStatusRepository.findOne({
      where: { deviceId: device.id },
      order: { recordedAt: 'DESC' },
    });

    // Get active assignment
    const activeAssignment = await this.inmateDeviceRepository.findOne({
      where: {
        deviceId: device.id,
        status: 'assigned',
      },
    });

    // Calculate time since last seen
    let timeSinceLastSeen: string | null = null;
    if (device.lastSeenAt) {
      const diffMs = Date.now() - device.lastSeenAt.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        timeSinceLastSeen = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHours > 0) {
        timeSinceLastSeen = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffMinutes > 0) {
        timeSinceLastSeen = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      } else {
        timeSinceLastSeen = 'Just now';
      }
    }

    return {
      ...device,
      batteryLevel: latestStatus?.batteryLevel ?? null,
      connectionStatus: latestStatus?.connectionStatus ?? null,
      isStreaming: activeAssignment?.isStreaming ?? false,
      assignedToInmate: activeAssignment?.inmateId ?? null,
      timeSinceLastSeen,
    };
  }

  /**
   * Get device statistics.
   * Scoped to the authenticated jail.
   */
  async getStatistics(jailId?: string): Promise<{
    total: number;
    active: number;
    offline: number;
    revoked: number;
    lowBattery: number;
  }> {
    let deviceIds: string[] | null = null;

    // Get device IDs for this jail if jail context exists
    if (jailId) {
      const secureBands = await this.secureBandRepository.find({
        where: { jailId },
      });
      const deviceUids = secureBands.map((sb) => sb.deviceUid);

      if (deviceUids.length === 0) {
        return { total: 0, active: 0, offline: 0, revoked: 0, lowBattery: 0 };
      }

      const devices = await this.deviceRepository
        .createQueryBuilder('device')
        .where('device.serialNumber IN (:...uids)', { uids: deviceUids })
        .getMany();

      deviceIds = devices.map((d) => d.id);
    }

    // Build queries with jail scope
    const baseQuery = this.deviceRepository.createQueryBuilder('device');
    if (deviceIds) {
      baseQuery.where('device.id IN (:...ids)', { ids: deviceIds });
    }

    const [total, active, revoked] = await Promise.all([
      baseQuery.clone().getCount(),
      baseQuery.clone().andWhere('device.status = :status', { status: 'active' }).getCount(),
      baseQuery.clone().andWhere('device.status = :status', { status: 'revoked' }).getCount(),
    ]);

    // Count offline devices (active but no data in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeDevicesQuery = baseQuery.clone().andWhere('device.status = :status', { status: 'active' });
    const activeDevices = await activeDevicesQuery.getMany();

    let offline = 0;
    let lowBattery = 0;

    for (const device of activeDevices) {
      if (!device.lastSeenAt || device.lastSeenAt < fiveMinutesAgo) {
        offline++;
      }

      // Check battery level
      const latestStatus = await this.deviceStatusRepository.findOne({
        where: { deviceId: device.id },
        order: { recordedAt: 'DESC' },
      });

      if (latestStatus?.batteryLevel !== null && latestStatus?.batteryLevel !== undefined && latestStatus.batteryLevel < 20) {
        lowBattery++;
      }
    }

    return {
      total,
      active,
      offline,
      revoked,
      lowBattery,
    };
  }
}
