/** Service for creating and managing alerts. */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Alert } from '../../entities/alert.entity';
import { AlertHistory } from '../../entities/alert-history.entity';
import { AlertType, Severity, AlertStatus } from '../types/event.types';
import { IdempotencyService } from './idempotency.service';
import { RealtimeEmitterService } from '../../realtime/services/realtime-emitter.service';

export interface CreateAlertInput {
  deviceId: string;
  inmateDeviceId: string | null;
  alertType: AlertType;
  severity: Severity;
  description: string;
  explanation?: string; // Why alert triggered
  confidence?: number; // Confidence score (0-1)
  alertData: Record<string, any>;
  idempotencyKey: string;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    @InjectRepository(AlertHistory)
    private alertHistoryRepository: Repository<AlertHistory>,
    private idempotencyService: IdempotencyService,
    private dataSource: DataSource,
    private realtimeEmitter: RealtimeEmitterService,
  ) {}

  /**
   * Create an alert if it doesn't already exist (idempotent).
   */
  async createAlert(input: CreateAlertInput): Promise<Alert | null> {
    // Check idempotency
    const isProcessed = await this.idempotencyService.isProcessed(
      input.idempotencyKey,
    );

    if (isProcessed) {
      this.logger.debug(
        `Alert already processed for idempotency key: ${input.idempotencyKey}`,
      );
      return null;
    }

    // Check for existing open alert of same type for this device
    const existingAlert = await this.alertRepository.findOne({
      where: {
        deviceId: input.deviceId,
        alertType: input.alertType,
        status: AlertStatus.OPEN,
      },
      order: {
        triggeredAt: 'DESC',
      },
    });

    // If alert exists and was triggered recently (within 5 minutes), don't create duplicate
    if (existingAlert) {
      const timeSinceTrigger = Date.now() - existingAlert.triggeredAt.getTime();
      if (timeSinceTrigger < 5 * 60 * 1000) {
        this.logger.debug(
          `Similar alert already exists: ${existingAlert.id}, skipping duplicate`,
        );
        await this.idempotencyService.markProcessed(input.idempotencyKey);
        return existingAlert;
      }
    }

    // Create new alert
    const alert = this.alertRepository.create({
      deviceId: input.deviceId,
      inmateDeviceId: input.inmateDeviceId,
      alertType: input.alertType,
      severity: input.severity,
      status: AlertStatus.OPEN,
      description: input.description,
      explanation: input.explanation || null,
      confidence: input.confidence || null,
      alertData: {
        ...input.alertData,
        idempotencyKey: input.idempotencyKey,
        confidence: input.confidence,
        explanation: input.explanation,
      },
      triggeredAt: new Date(),
    });

    try {
      const savedAlert = await this.alertRepository.save(alert);

      // Create alert history entry
      await this.alertHistoryRepository.save({
        alertId: savedAlert.id,
        action: 'created',
        notes: `Alert triggered: ${input.description}`,
        metadata: {
          idempotencyKey: input.idempotencyKey,
        },
      });

      // Mark as processed
      await this.idempotencyService.markProcessed(input.idempotencyKey);

      // Emit WebSocket event
      try {
        this.realtimeEmitter.emitAlert({
          alertId: savedAlert.id,
          deviceId: savedAlert.deviceId,
          inmateDeviceId: savedAlert.inmateDeviceId,
          alertType: savedAlert.alertType,
          severity: savedAlert.severity,
          status: savedAlert.status,
          description: savedAlert.description || '',
          triggeredAt: savedAlert.triggeredAt.toISOString(),
        });
      } catch (error) {
        this.logger.warn(
          `Failed to emit WebSocket alert event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      this.logger.log(
        `Alert created: ${savedAlert.id} (${input.alertType}, ${input.severity})`,
      );

      return savedAlert;
    } catch (error) {
      this.logger.error(
        `Failed to create alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get open alerts for a device.
   */
  async getOpenAlerts(deviceId: string): Promise<Alert[]> {
    return this.alertRepository.find({
      where: {
        deviceId,
        status: AlertStatus.OPEN,
      },
      order: {
        triggeredAt: 'DESC',
      },
    });
  }
}
