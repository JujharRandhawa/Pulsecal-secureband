/** Service for publishing events to queues. */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MetricIngestedEvent } from '../types/event.types';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    @InjectQueue('metric-events')
    private metricEventsQueue: Queue,
    private idempotencyService: IdempotencyService,
  ) {}

  /**
   * Publish a metric ingested event to the queue.
   */
  async publishMetricEvent(event: Omit<MetricIngestedEvent, 'idempotencyKey' | 'timestamp'>): Promise<void> {
    const timestamp = new Date();
    const idempotencyKey = this.idempotencyService.generateKey(
      'metric.ingested',
      event.deviceId,
      event.metricId,
      timestamp,
    );

    // Check if already processed
    const isProcessed = await this.idempotencyService.isProcessed(idempotencyKey);
    if (isProcessed) {
      this.logger.debug(`Event already processed: ${idempotencyKey}`);
      return;
    }

    const fullEvent: MetricIngestedEvent = {
      ...event,
      idempotencyKey,
      timestamp,
    };

    try {
      await this.metricEventsQueue.add(
        'process-metric',
        fullEvent,
        {
          jobId: idempotencyKey, // Use idempotency key as job ID for deduplication
          attempts: 3, // Retry up to 3 times
          backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 second delay
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      );

      this.logger.debug(`Published metric event: ${event.metricId}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish metric event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
