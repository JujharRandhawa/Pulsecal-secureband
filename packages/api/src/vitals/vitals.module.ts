import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalsController } from './vitals.controller';
import { VitalMetric } from '../entities/vital-metric.entity';
import { Device } from '../entities/device.entity';
import { SecureBand } from '../secureband/entities/secureband.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VitalMetric, Device, SecureBand])],
  controllers: [VitalsController],
})
export class VitalsModule {}
