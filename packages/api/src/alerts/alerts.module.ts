import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsController } from './alerts.controller';
import { Alert } from '../entities/alert.entity';
import { Device } from '../entities/device.entity';
import { SecureBand } from '../secureband/entities/secureband.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Device, SecureBand])],
  controllers: [AlertsController],
})
export class AlertsModule {}
