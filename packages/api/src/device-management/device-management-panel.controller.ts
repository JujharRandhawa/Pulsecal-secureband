/**
 * Controller for SecureBand device management panel.
 * 
 * Security: All endpoints require jail authentication via AuthGuard.
 * Operations are scoped to the authenticated jail's devices.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DeviceManagementService } from './services/device-management.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentJail } from '../auth/decorators/current-jail.decorator';
import { AuditCritical } from '../audit/decorators/audit.decorator';

@Controller('device-management-panel')
@UseGuards(AuthGuard)  // All operations require authenticated jail session
export class DeviceManagementPanelController {
  constructor(private deviceManagementService: DeviceManagementService) {}

  /**
   * List all devices with optional status filter.
   * Only returns devices belonging to the authenticated jail.
   */
  @Get()
  async findAll(
    @Query('status') status?: string,
    @CurrentJail() jail?: { id: string },
  ) {
    return this.deviceManagementService.findAll(status, jail?.id);
  }

  /**
   * Get device statistics.
   * Only includes statistics for the authenticated jail's devices.
   */
  @Get('statistics')
  async getStatistics(@CurrentJail() jail?: { id: string }) {
    return this.deviceManagementService.getStatistics(jail?.id);
  }

  /**
   * Get device by ID.
   * Verifies device belongs to the authenticated jail.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentJail() jail?: { id: string },
  ) {
    return this.deviceManagementService.findOne(id, jail?.id);
  }

  /**
   * Create a new device for this jail.
   */
  @Post()
  @AuditCritical({
    action: 'CREATE_DEVICE',
    resourceType: 'device',
  })
  async create(
    @Body() createDto: CreateDeviceDto,
    @Req() request: Request,
    @CurrentJail() jail?: { id: string },
  ) {
    const jailId = jail?.id || 'system';
    return this.deviceManagementService.create(createDto, jailId, request);
  }

  /**
   * Update device.
   * Verifies device belongs to the authenticated jail.
   */
  @Put(':id')
  @AuditCritical({
    action: 'UPDATE_DEVICE',
    resourceType: 'device',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateDeviceDto,
    @Req() request: Request,
    @CurrentJail() jail?: { id: string },
  ) {
    const jailId = jail?.id || 'system';
    return this.deviceManagementService.update(id, updateDto, jailId, request);
  }

  /**
   * Remove (revoke) device.
   * Verifies device belongs to the authenticated jail before removal.
   */
  @Delete(':id')
  @AuditCritical({
    action: 'REMOVE_DEVICE',
    resourceType: 'device',
  })
  async remove(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() request: Request,
    @CurrentJail() jail?: { id: string },
  ) {
    const jailId = jail?.id || 'system';
    await this.deviceManagementService.remove(id, jailId, request, body.reason);
    return { message: 'Device removed successfully' };
  }
}
