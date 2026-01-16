/** Event pipeline module. */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '../config/config.service';
import { Alert, AlertHistory, VitalMetric } from '../entities';
import { AlertRulesEngine } from './rules/alert-rules.engine';
import { AlertService } from './services/alert.service';
import { IdempotencyService } from './services/idempotency.service';
import { EventPublisherService } from './services/event-publisher.service';
import { MetricProcessor } from './processors/metric-processor.processor';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, AlertHistory, VitalMetric]),
    RealtimeModule,
    AiIntegrationModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get('redis');

        return {
          connection: {
            host: redisConfig?.host || 'localhost',
            port: redisConfig?.port || 6379,
            password: redisConfig?.password,
            db: redisConfig?.db || 0,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: 'metric-events',
    }),
  ],
  providers: [
    AlertRulesEngine,
    AlertService,
    IdempotencyService,
    EventPublisherService,
    MetricProcessor,
  ],
  exports: [EventPublisherService, AlertService],
})
export class EventPipelineModule {}
