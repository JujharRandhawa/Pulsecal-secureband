import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { SecureBandService } from './secureband.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentJail } from '../auth/decorators/current-jail.decorator';
import { AddSecureBandDto } from './dto/add-secureband.dto';
import { RemoveSecureBandDto } from './dto/remove-secureband.dto';
import { SecureBandResponseDto, SecureBandAuthTokenDto } from './dto/secureband-response.dto';
import { SecureBandStatus } from './entities/secureband.entity';
import { AuditCritical } from '../audit/decorators/audit.decorator';

@Controller('securebands')
@UseGuards(AuthGuard)
export class SecureBandController {
  constructor(private readonly secureBandService: SecureBandService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AuditCritical({
    action: 'secureband_added',
    resourceType: 'secureband',
  })
  async addSecureBand(
    @Body() dto: AddSecureBandDto,
    @CurrentJail() jail: { id: string },
    @Request() req: any,
  ): Promise<SecureBandAuthTokenDto> {
    return this.secureBandService.addSecureBand(
      dto.deviceUid,
      jail.id,
      jail.id, // Using jail ID as addedBy for now
      dto,
    );
  }

  @Post(':deviceUid/remove')
  @HttpCode(HttpStatus.OK)
  @AuditCritical({
    action: 'secureband_removed',
    resourceType: 'secureband',
  })
  async removeSecureBand(
    @Param('deviceUid') deviceUid: string,
    @Body() dto: RemoveSecureBandDto,
    @CurrentJail() jail: { id: string },
  ): Promise<SecureBandResponseDto> {
    return this.secureBandService.removeSecureBand(
      deviceUid,
      jail.id,
      jail.id, // Using jail ID as removedBy for now
      dto,
    );
  }

  @Get(':deviceUid')
  async getSecureBand(
    @Param('deviceUid') deviceUid: string,
    @CurrentJail() jail: { id: string },
  ): Promise<SecureBandResponseDto> {
    return this.secureBandService.getSecureBand(deviceUid, jail.id);
  }

  @Get()
  async listSecureBands(
    @CurrentJail() jail: { id: string },
    @Query('status') status?: SecureBandStatus,
  ): Promise<SecureBandResponseDto[]> {
    return this.secureBandService.listSecureBands(jail.id, status);
  }

  @Get(':deviceUid/token')
  async getDeviceToken(
    @Param('deviceUid') deviceUid: string,
    @CurrentJail() jail: { id: string },
  ) {
    // This endpoint should return the auth token for a device
    // In production, implement proper token retrieval with additional security
    const device = await this.secureBandService.getSecureBand(deviceUid, jail.id);
    if (device.status !== SecureBandStatus.ACTIVE) {
      throw new Error('Device is not active');
    }
    // Token should be retrieved securely, not exposed via API
    return { message: 'Token retrieval requires secure channel' };
  }
}
