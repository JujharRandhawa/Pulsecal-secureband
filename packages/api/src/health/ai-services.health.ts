/** AI services health indicator. */

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '../config/config.service';

@Injectable()
export class AiServicesHealthIndicator extends HealthIndicator {
  constructor(private configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const aiServicesConfig = this.configService.get('aiServices');
    const baseUrl = aiServicesConfig?.url || 'http://localhost:8000';
    const enabled = aiServicesConfig?.enabled !== false;

    if (!enabled) {
      return this.getStatus(key, true, {
        message: 'AI services disabled',
        enabled: false,
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI services returned ${response.status}`);
      }

      const data = await response.json();
      const responseData = data as { timestamp?: string; status?: string };
      const responseTime = Date.now() - (responseData.timestamp ? new Date(responseData.timestamp).getTime() : Date.now());

      return this.getStatus(key, true, {
        url: baseUrl,
        status: responseData.status || 'ok',
        responseTime: `${Math.abs(responseTime)}ms`,
      });
    } catch (error) {
      // Don't fail health check if AI services are unavailable
      // Just mark as degraded
      return this.getStatus(key, false, {
        url: baseUrl,
        message: error instanceof Error ? error.message : 'Unknown error',
        degraded: true,
      });
    }
  }
}
