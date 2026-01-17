/** Redis health indicator. */

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '../config/config.service';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redisClient: Redis | null = null;

  constructor(private configService: ConfigService) {
    super();
    const redisConfig = this.configService.get('redis');
    if (redisConfig) {
      this.redisClient = new Redis({
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        db: redisConfig.db || 0,
        retryStrategy: () => null, // Don't retry for health checks
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
    }
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.redisClient) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, { message: 'Redis client not configured' }),
      );
    }

    try {
      const startTime = Date.now();
      await this.redisClient.ping();
      const responseTime = Date.now() - startTime;

      return this.getStatus(key, true, {
        host: this.redisClient.options.host,
        port: this.redisClient.options.port,
        responseTime: `${responseTime}ms`,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
