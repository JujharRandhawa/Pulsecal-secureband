/**
 * Controller for device binding and management.
 * 
 * Security: All endpoints require jail authentication via AuthGuard.
 * Ownership: All operations are scoped to the authenticated jail's devices.
 */

import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DeviceBindingService, BindDeviceInput, UnbindDeviceInput } from './services/device-binding.service';
import { DeviceStreamingService } from './services/device-streaming.service';
import { AuthGuard, AuthenticatedRequest } from '../auth/guards/auth.guard';
import { CurrentJail } from '../auth/decorators/current-jail.decorator';
import { AuditCritical } from '../audit/decorators/audit.decorator';

@Controller('device-management')
@UseGuards(AuthGuard)
export class DeviceManagementController {
  constructor(
    private deviceBindingService: DeviceBindingService,
    private deviceStreamingService: DeviceStreamingService,
  ) {}

  /**
   * Bind device to inmate (automatically starts streaming).
   * Only devices owned by the authenticated jail can be bound.
   */
  @Post('bind')
  @HttpCode(HttpStatus.CREATED)
  @AuditCritical({
    action: 'DEVICE_BOUND',
    resourceType: 'device',
  })
  async bindDevice(
    @Body() input: BindDeviceInput,
    @CurrentJail() jail: { id: string },
  ) {
    // Ensure the device belongs to this jail
    const enrichedInput = {
      ...input,
      jailId: jail.id,
    };
    return this.deviceBindingService.bindDevice(enrichedInput);
  }

  /**
   * Unbind device from inmate (automatically stops streaming).
   * Only devices owned by the authenticated jail can be unbound.
   */
  @Delete('unbind/:inmateDeviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditCritical({
    action: 'DEVICE_UNBOUND',
    resourceType: 'device',
  })
  async unbindDevice(
    @Param('inmateDeviceId') inmateDeviceId: string,
    @CurrentJail() jail: { id: string },
  ) {
    // Verify ownership before unbinding
    await this.deviceBindingService.unbindDevice({
      inmateDeviceId,
      jailId: jail.id,
    });
  }

  /**
   * Get active streaming devices for this jail.
   */
  @Get('streaming/active')
  async getActiveStreams(@CurrentJail() jail: { id: string }) {
    const allStreams = this.deviceStreamingService.getActiveStreams();
    // Filter to only show streams for this jail's devices
    const jailStreams = allStreams.filter((stream) => stream.jailId === jail.id);
    return {
      streams: jailStreams,
      count: jailStreams.length,
    };
  }

  /**
   * Get stream info for a specific device.
   * Only returns info if device belongs to authenticated jail.
   */
  @Get('streaming/:deviceId')
  async getStreamInfo(
    @Param('deviceId') deviceId: string,
    @CurrentJail() jail: { id: string },
  ) {
    const streamInfo = this.deviceStreamingService.getStreamInfo(deviceId);
    if (!streamInfo) {
      return { streaming: false };
    }
    
    // Verify ownership
    if (streamInfo.jailId !== jail.id) {
      throw new ForbiddenException('Access denied: Device does not belong to your facility');
    }
    
    return {
      streaming: true,
      ...streamInfo,
    };
  }
}
