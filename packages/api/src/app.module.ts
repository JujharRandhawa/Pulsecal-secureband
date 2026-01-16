/**
 * Main application module.
 * 
 * Security Configuration:
 * - All API endpoints require authentication (jail session or device token)
 * - Rate limiting is enabled globally
 * - Audit logging tracks all sensitive operations
 * - Health check endpoint is the only public endpoint
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './common/logger/logger.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { EventPipelineModule } from './event-pipeline/event-pipeline.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AiIntegrationModule } from './ai-integration/ai-integration.module';
import { MetricsModule } from './observability/metrics/metrics.module';
import { TracingModule } from './observability/tracing/tracing.module';
import { RateLimitingModule } from './observability/rate-limiting/rate-limiting.module';
import { DeviceManagementModule } from './device-management/device-management.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { ForensicModule } from './forensic/forensic.module';
import { SecureBandModule } from './secureband/secureband.module';
import { VitalsModule } from './vitals/vitals.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    // Core infrastructure
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    
    // Security & Authentication
    AuthModule,
    AuditModule,
    
    // Observability
    HealthModule,
    MetricsModule,
    TracingModule,
    RateLimitingModule,
    
    // Business logic
    SecureBandModule,
    DeviceManagementModule,
    RealtimeModule,
    AiIntegrationModule,
    EventPipelineModule,
    IngestionModule,
    ForensicModule,
    VitalsModule,
    AlertsModule,
  ],
  controllers: [],  // No public endpoints at root level
  providers: [],
})
export class AppModule {}
