import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ForensicService } from './forensic.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentJail } from '../auth/decorators/current-jail.decorator';
import { AuditCritical } from '../audit/decorators/audit.decorator';

interface EnableForensicModeDto {
  reason: string;
  readOnly?: boolean;
}

interface DisableForensicModeDto {
  reason: string;
}

@Controller('forensic')
@UseGuards(AuthGuard)
export class ForensicController {
  constructor(private readonly forensicService: ForensicService) {}

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @AuditCritical({
    action: 'forensic_mode_enabled',
    resourceType: 'system',
  })
  async enableForensicMode(
    @Body() dto: EnableForensicModeDto,
    @CurrentJail() jail: { id: string },
  ) {
    return this.forensicService.enableForensicMode(
      jail.id,
      dto.reason,
      dto.readOnly ?? true,
    );
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @AuditCritical({
    action: 'forensic_mode_disabled',
    resourceType: 'system',
  })
  async disableForensicMode(
    @Body() dto: DisableForensicModeDto,
    @CurrentJail() jail: { id: string },
  ) {
    return this.forensicService.disableForensicMode(jail.id, dto.reason);
  }

  @Get('status')
  async getStatus() {
    const [isActive, status] = await Promise.all([
      this.forensicService.isForensicModeActive(),
      this.forensicService.getForensicModeStatus(),
    ]);

    return {
      isActive,
      status,
    };
  }

  @Get('history')
  async getHistory() {
    return this.forensicService.getForensicModeHistory();
  }
}
