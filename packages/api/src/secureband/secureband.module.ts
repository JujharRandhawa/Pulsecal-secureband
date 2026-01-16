import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecureBandService } from './secureband.service';
import { SecureBandController } from './secureband.controller';
import { SecureBand } from './entities/secureband.entity';
import { DeviceAuthGuard } from './guards/device-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { ForensicModule } from '../forensic/forensic.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecureBand]),
    AuditModule,
    ForensicModule,
  ],
  controllers: [SecureBandController],
  providers: [SecureBandService, DeviceAuthGuard],
  exports: [SecureBandService, DeviceAuthGuard],
})
export class SecureBandModule {}
