/**
 * Device management module for binding, streaming, and health monitoring.
 * 
 * Security: All controllers are protected by AuthGuard or AdminGuard.
 * Ownership verification is enforced at the service level.
 */

import { Module, OnModuleDestroy } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { InmateDevice } from '../entities/inmate-device.entity';
import { DeviceStatus } from '../entities/device-status.entity';
import { Alert } from '../entities/alert.entity';
import { SecureBand } from '../secureband/entities/secureband.entity';
import { DeviceBindingService } from './services/device-binding.service';
import { DeviceStreamingService } from './services/device-streaming.service';
import { DeviceHealthMonitor } from './services/device-health-monitor.service';
import { DeviceManagementService } from './services/device-management.service';
import { DeviceManagementController } from './device-management.controller';
import { DeviceManagementPanelController } from './device-management-panel.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, InmateDevice, DeviceStatus, SecureBand, Alert]),
    RealtimeModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [DeviceManagementController, DeviceManagementPanelController],
  providers: [
    DeviceBindingService,
    DeviceStreamingService,
    DeviceHealthMonitor,
    DeviceManagementService,
  ],
  exports: [
    DeviceBindingService,
    DeviceStreamingService,
    DeviceHealthMonitor,
    DeviceManagementService,
  ],
})
export class DeviceManagementModule implements OnModuleDestroy {
  constructor(private deviceHealthMonitor: DeviceHealthMonitor) {}

  onModuleDestroy() {
    this.deviceHealthMonitor.onModuleDestroy();
  }
}
