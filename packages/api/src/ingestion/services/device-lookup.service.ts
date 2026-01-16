import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';

@Injectable()
export class DeviceLookupService {
  private readonly logger = new Logger(DeviceLookupService.name);
  private deviceCache = new Map<string, { id: string; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  async getDeviceIdBySerial(serialNumber: string): Promise<string> {
    // Check cache first
    const cached = this.deviceCache.get(serialNumber);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.id;
    }

    // Query database
    const device = await this.deviceRepository.findOne({
      where: { serialNumber },
      select: ['id'],
    });

    if (!device) {
      this.logger.warn(`Device not found: ${serialNumber}`);
      throw new NotFoundException(`Device with serial number ${serialNumber} not found`);
    }

    // Update cache
    this.deviceCache.set(serialNumber, {
      id: device.id,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return device.id;
  }

  async getDeviceIdByMac(macAddress: string): Promise<string> {
    const device = await this.deviceRepository.findOne({
      where: { macAddress },
      select: ['id'],
    });

    if (!device) {
      this.logger.warn(`Device not found: ${macAddress}`);
      throw new NotFoundException(`Device with MAC address ${macAddress} not found`);
    }

    return device.id;
  }

  async getGatewayIdBySerial(serialNumber: string): Promise<string | null> {
    // This would query the gateways table
    // For now, returning null as gateway lookup is not critical for ingestion
    // TODO: Implement gateway lookup when gateway entity is created
    return null;
  }

  async getInmateDeviceId(deviceId: string, recordedAt: Date): Promise<string | null> {
    // Query for active inmate device assignment at the time of recording
    // This is a complex query that would join inmate_devices table
    // For now, returning null - can be implemented later when needed
    // TODO: Implement inmate device lookup
    return null;
  }

  clearCache(): void {
    this.deviceCache.clear();
  }
}
