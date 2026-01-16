/** AI integration module. */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAnalysis } from '../entities/ai-analysis.entity';
import { AiServiceClient } from './services/ai-service-client.service';
import { AiAnalysisService } from './services/ai-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiAnalysis])],
  providers: [AiServiceClient, AiAnalysisService],
  exports: [AiServiceClient, AiAnalysisService],
})
export class AiIntegrationModule {}
