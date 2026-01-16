/**
 * Ingestion module for receiving device telemetry data.
 * 
 * Security: All ingestion endpoints require device authentication.
 * Only ACTIVE SecureBands with valid tokens can submit data.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './services/ingestion.service';
import { DeviceLookupService } from './services/device-lookup.service';
import { PacketValidatorService } from './services/packet-validator.service';
import { EventPipelineModule } from '../event-pipeline/event-pipeline.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DeviceManagementModule } from '../device-management/device-management.module';
import { SecureBandModule } from '../secureband/secureband.module';
import {
  Device,
  VitalMetric,
  LocationMetric,
  DeviceStatus,
} from '../entities';
import { PacketSequence } from '../entities/packet-sequence.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, VitalMetric, LocationMetric, DeviceStatus, PacketSequence]),
    EventPipelineModule,
    RealtimeModule,
    DeviceManagementModule,
    SecureBandModule,  // For DeviceAuthGuard
  ],
  controllers: [IngestionController],
  providers: [IngestionService, DeviceLookupService, PacketValidatorService],
  exports: [IngestionService, DeviceLookupService, PacketValidatorService],
})
export class IngestionModule {}
