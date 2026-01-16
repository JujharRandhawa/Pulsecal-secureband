import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForensicService } from './forensic.service';
import { ForensicController } from './forensic.controller';
import { ForensicModeGuard } from './guards/forensic-mode.guard';
import { ForensicMode } from './entities/forensic-mode.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ForensicMode]),
    AuditModule,
  ],
  controllers: [ForensicController],
  providers: [ForensicService, ForensicModeGuard],
  exports: [ForensicService, ForensicModeGuard],
})
export class ForensicModule {}
