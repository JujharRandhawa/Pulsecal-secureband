import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VitalMetric } from '../entities/vital-metric.entity';
import { Device } from '../entities/device.entity';
import { SecureBand } from '../secureband/entities/secureband.entity';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentJail } from '../auth/decorators/current-jail.decorator';

@Controller('vitals')
@UseGuards(AuthGuard)
export class VitalsController {
  constructor(
    @InjectRepository(VitalMetric)
    private vitalMetricRepository: Repository<VitalMetric>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(SecureBand)
    private secureBandRepository: Repository<SecureBand>,
  ) {}

  @Get()
  async getVitals(
    @CurrentJail() jail: { id: string },
    @Query('deviceId') deviceId?: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    // Get SecureBands for this jail
    const secureBands = await this.secureBandRepository.find({
      where: { jailId: jail.id },
    });
    const deviceUids = secureBands.map((sb) => sb.deviceUid);

    if (deviceUids.length === 0) {
      return [];
    }

    const query = this.vitalMetricRepository
      .createQueryBuilder('vm')
      .leftJoinAndSelect('vm.device', 'device')
      .where('device.serialNumber IN (:...uids)', { uids: deviceUids })
      .orderBy('vm.recordedAt', 'DESC')
      .limit(limit);

    if (deviceId) {
      query.andWhere('vm.deviceId = :deviceId', { deviceId });
    }

    const vitals = await query.getMany();

    return vitals.map((vital) => ({
      id: vital.id,
      deviceId: vital.deviceId,
      recordedAt: vital.recordedAt.toISOString(),
      heartRate: vital.heartRate,
      temperatureCelsius: vital.temperatureCelsius,
      oxygenSaturation: vital.oxygenSaturation,
      batteryLevel: vital.batteryLevel,
      deviceSerial: vital.device?.serialNumber,
    }));
  }

  @Get('historical')
  async getHistorical(
    @CurrentJail() jail: { id: string },
    @Query('deviceId') deviceId?: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours?: number,
  ) {
    // Get SecureBands for this jail
    const secureBands = await this.secureBandRepository.find({
      where: { jailId: jail.id },
    });
    const deviceUids = secureBands.map((sb) => sb.deviceUid);

    if (deviceUids.length === 0) {
      return { heartRate: [], temperature: [], oxygenSaturation: [] };
    }

    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const query = this.vitalMetricRepository
      .createQueryBuilder('vm')
      .leftJoin('vm.device', 'device')
      .where('device.serialNumber IN (:...uids)', { uids: deviceUids })
      .andWhere('vm.recordedAt >= :startTime', { startTime })
      .orderBy('vm.recordedAt', 'ASC');

    if (deviceId) {
      query.andWhere('vm.deviceId = :deviceId', { deviceId });
    }

    const vitals = await query.getMany();

    const heartRate: Array<{ timestamp: string; value: number }> = [];
    const temperature: Array<{ timestamp: string; value: number }> = [];
    const oxygenSaturation: Array<{ timestamp: string; value: number }> = [];

    vitals.forEach((vital) => {
      const timestamp = vital.recordedAt.toISOString();
      if (vital.heartRate !== null) {
        heartRate.push({ timestamp, value: vital.heartRate });
      }
      if (vital.temperatureCelsius !== null) {
        temperature.push({ timestamp, value: Number(vital.temperatureCelsius) });
      }
      if (vital.oxygenSaturation !== null) {
        oxygenSaturation.push({ timestamp, value: vital.oxygenSaturation });
      }
    });

    return { heartRate, temperature, oxygenSaturation };
  }
}
