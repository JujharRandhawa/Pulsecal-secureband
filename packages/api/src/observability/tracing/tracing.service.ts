/** OpenTelemetry tracing service. */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class TracingService implements OnModuleInit {
  private readonly logger = new Logger(TracingService.name);
  private sdk: NodeSDK | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Disable tracing in production by default
    const tracingEnabled = 
      process.env.NODE_ENV !== 'production' && 
      process.env.TRACING_ENABLED !== 'false';
    const jaegerEndpoint =
      process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';

    if (!tracingEnabled) {
      this.logger.log('Tracing is disabled (production mode or TRACING_ENABLED=false)');
      return;
    }

    try {
      const serviceName =
        this.configService.app?.name || 'pulsecal-api';
      const serviceVersion =
        this.configService.app?.version || '1.0.0';

      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      });

      const jaegerExporter = new JaegerExporter({
        endpoint: jaegerEndpoint,
      });

      this.sdk = new NodeSDK({
        resource,
        traceExporter: jaegerExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false,
            },
          }),
        ],
      });

      this.sdk.start();
      this.logger.log(`Tracing initialized: ${jaegerEndpoint}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize tracing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.logger.log('Tracing shutdown');
    }
  }
}
