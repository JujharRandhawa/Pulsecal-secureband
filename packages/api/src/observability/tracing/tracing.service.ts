/** OpenTelemetry tracing service. */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// OpenTelemetry imports commented out - packages not installed
// import { NodeSDK } from '@opentelemetry/sdk-node';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
// import { Resource } from '@opentelemetry/resources';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class TracingService implements OnModuleInit {
  private readonly logger = new Logger(TracingService.name);
  private sdk: any = null; // Using any to avoid OpenTelemetry type issues

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Tracing disabled - OpenTelemetry packages not installed or not needed
    this.logger.log('Tracing is disabled (OpenTelemetry packages not available)');
    return;
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.logger.log('Tracing shutdown');
    }
  }
}
