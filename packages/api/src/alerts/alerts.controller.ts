import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { Device } from '../entities/device.entity';
import { SecureBand } from '../secureband/entities/secureband.entity';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentJail } from '../auth/decorators/current-jail.decorator';

@Controller('alerts')
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(SecureBand)
    private secureBandRepository: Repository<SecureBand>,
  ) {}

  @Get()
  async getAlerts(
    @CurrentJail() jail: { id: string },
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
  ) {
    // Get SecureBands for this jail
    const secureBands = await this.secureBandRepository.find({
      where: { jailId: jail.id },
    });
    const deviceUids = secureBands.map((sb) => sb.deviceUid);

    if (deviceUids.length === 0) {
      return [];
    }

    const query = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.device', 'device')
      .where('device.serialNumber IN (:...uids)', { uids: deviceUids })
      .orderBy('alert.triggeredAt', 'DESC')
      .limit(limit);

    if (status) {
      query.andWhere('alert.status = :status', { status });
    }

    if (severity) {
      query.andWhere('alert.severity = :severity', { severity });
    }

    const alerts = await query.getMany();

    return alerts.map((alert) => ({
      id: alert.id,
      deviceId: alert.deviceId,
      alertType: alert.alertType,
      severity: alert.severity,
      status: alert.status,
      description: alert.description,
      explanation: alert.explanation,
      confidence: alert.confidence,
      triggeredAt: alert.triggeredAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt?.toISOString() || null,
      resolvedAt: alert.resolvedAt?.toISOString() || null,
      deviceSerial: alert.device?.serialNumber,
    }));
  }

  @Post(':id/acknowledge')
  async acknowledgeAlert(
    @Param('id') id: string,
    @CurrentJail() jail: { id: string },
  ) {
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: ['device'],
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    // Verify device belongs to jail via SecureBand
    const secureBand = await this.secureBandRepository.findOne({
      where: { deviceUid: alert.device.serialNumber, jailId: jail.id },
    });

    if (!secureBand) {
      throw new ForbiddenException('Access denied: Alert does not belong to your facility');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    // alert.acknowledgedBy = currentUser.id; // TODO: Get from auth context

    await this.alertRepository.save(alert);

    return { success: true, alert };
  }

  @Post(':id/resolve')
  async resolveAlert(
    @Param('id') id: string,
    @Body() body: { resolutionNotes?: string },
    @CurrentJail() jail: { id: string },
  ) {
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: ['device'],
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    // Verify device belongs to jail via SecureBand
    const secureBand = await this.secureBandRepository.findOne({
      where: { deviceUid: alert.device.serialNumber, jailId: jail.id },
    });

    if (!secureBand) {
      throw new ForbiddenException('Access denied: Alert does not belong to your facility');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolutionNotes = body.resolutionNotes;
    // alert.resolvedBy = currentUser.id; // TODO: Get from auth context

    await this.alertRepository.save(alert);

    return { success: true, alert };
  }
}
