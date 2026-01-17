/**
 * Controller for device data ingestion.
 * 
 * Security: All endpoints require valid device authentication via DeviceAuthGuard.
 * Only ACTIVE SecureBands with valid tokens can submit data.
 * Revoked devices are rejected at the authentication layer.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { IngestionService } from './services/ingestion.service';
import {
  PpgDataDto,
  TemperatureDataDto,
  ImuDataDto,
  DeviceStatusDto,
  BatchIngestionDto,
} from './dto';
import { IngestionExceptionFilter } from './filters/ingestion-exception.filter';
import { DeviceAuthGuard, DeviceAuthenticatedRequest } from '../secureband/guards/device-auth.guard';

@Controller('ingestion')
@UseFilters(IngestionExceptionFilter)
@UseGuards(DeviceAuthGuard)  // All ingestion requires device authentication
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly ingestionService: IngestionService) {}

  @Post('ppg')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestPpg(
    @Body() dto: PpgDataDto,
  ): Promise<{ status: string; message: string }> {
    try {
      // Process asynchronously
      this.ingestionService.ingestPpgData(dto).catch((error) => {
        this.logger.error(`Async PPG ingestion failed: ${(error instanceof Error ? error.message : String(error))}`, (error instanceof Error ? error.stack : undefined));
      });

      return {
        status: 'accepted',
        message: 'PPG data ingestion initiated',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`PPG ingestion error: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to process PPG data: ${err.message}`);
    }
  }

  @Post('temperature')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestTemperature(
    @Body() dto: TemperatureDataDto,
  ): Promise<{ status: string; message: string }> {
    try {
      // Process asynchronously
      this.ingestionService.ingestTemperatureData(dto).catch((error) => {
        this.logger.error(
          `Async temperature ingestion failed: ${(error instanceof Error ? error.message : String(error))}`,
          (error instanceof Error ? error.stack : undefined),
        );
      });

      return {
        status: 'accepted',
        message: 'Temperature data ingestion initiated',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Temperature ingestion error: ${err.message}`, err.stack);
      throw new BadRequestException(
        `Failed to process temperature data: ${err.message}`,
      );
    }
  }

  @Post('imu')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestImu(@Body() dto: ImuDataDto): Promise<{ status: string; message: string }> {
    try {
      // Process asynchronously
      this.ingestionService.ingestImuData(dto).catch((error) => {
        this.logger.error(`Async IMU ingestion failed: ${(error instanceof Error ? error.message : String(error))}`, (error instanceof Error ? error.stack : undefined));
      });

      return {
        status: 'accepted',
        message: 'IMU data ingestion initiated',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`IMU ingestion error: ${err.message}`, err.stack);
      throw new BadRequestException(`Failed to process IMU data: ${err.message}`);
    }
  }

  @Post('status')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestDeviceStatus(
    @Body() dto: DeviceStatusDto,
  ): Promise<{ status: string; message: string }> {
    try {
      // Process asynchronously
      this.ingestionService.ingestDeviceStatus(dto).catch((error) => {
        this.logger.error(
          `Async device status ingestion failed: ${(error instanceof Error ? error.message : String(error))}`,
          (error instanceof Error ? error.stack : undefined),
        );
      });

      return {
        status: 'accepted',
        message: 'Device status ingestion initiated',
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Device status ingestion error: ${err.message}`, err.stack);
      throw new BadRequestException(
        `Failed to process device status: ${err.message}`,
      );
    }
  }

  @Post('batch')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestBatch(
    @Body() dto: BatchIngestionDto,
  ): Promise<{ status: string; message: string; queued: number }> {
    try {
      const queued = dto.metrics.length;

      if (queued === 0) {
        throw new BadRequestException('Batch cannot be empty');
      }

      // Process batch asynchronously
      this.ingestionService.ingestBatch(dto.metrics).catch((error) => {
        const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
        this.logger.error(
          `Async batch ingestion failed: ${errorMessage}`,
          error instanceof Error ? (error instanceof Error ? error.stack : undefined) : undefined,
        );
      });

      return {
        status: 'accepted',
        message: 'Batch ingestion initiated',
        queued,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
      this.logger.error(
        `Batch ingestion error: ${errorMessage}`,
        error instanceof Error ? (error instanceof Error ? error.stack : undefined) : undefined,
      );
      throw new BadRequestException(`Failed to process batch: ${errorMessage}`);
    }
  }
}
