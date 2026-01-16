/** Service for ensuring idempotent processing of events. */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../../entities/alert.entity';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly processedKeys = new Set<string>();
  private readonly KEY_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
  ) {}

  /**
   * Check if an event has already been processed.
   */
  async isProcessed(idempotencyKey: string): Promise<boolean> {
    // Check in-memory cache first
    if (this.processedKeys.has(idempotencyKey)) {
      return true;
    }

    // Check database for existing alert with same idempotency key
    // We store idempotency key in alert_data for lookup
    const existingAlert = await this.alertRepository.findOne({
      where: {
        alertData: {
          idempotencyKey,
        } as any,
      },
    });

    if (existingAlert) {
      this.processedKeys.add(idempotencyKey);
      return true;
    }

    return false;
  }

  /**
   * Mark an event as processed.
   */
  async markProcessed(idempotencyKey: string): Promise<void> {
    this.processedKeys.add(idempotencyKey);

    // Clean up old keys periodically (simple implementation)
    if (this.processedKeys.size > 10000) {
      this.processedKeys.clear();
    }
  }

  /**
   * Generate a unique idempotency key for an event.
   */
  generateKey(
    eventType: string,
    deviceId: string,
    metricId: string,
    timestamp: Date,
  ): string {
    // Round timestamp to nearest minute for idempotency window
    const roundedTimestamp = Math.floor(timestamp.getTime() / 60000) * 60000;
    return `${eventType}:${deviceId}:${metricId}:${roundedTimestamp}`;
  }
}
