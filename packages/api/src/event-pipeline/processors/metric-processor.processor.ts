/** BullMQ processor for metric events. */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { AlertRulesEngine } from '../rules/alert-rules.engine';
import { AlertService } from '../services/alert.service';
import { AiAnalysisService } from '../../ai-integration/services/ai-analysis.service';
import { VitalMetric } from '../../entities/vital-metric.entity';
import { MetricIngestedEvent } from '../types/event.types';
import { ConfigService } from '../../config/config.service';

@Processor('metric-events')
export class MetricProcessor extends WorkerHost {
  private readonly logger = new Logger(MetricProcessor.name);
  private readonly aiEnabled: boolean;

  constructor(
    private alertRulesEngine: AlertRulesEngine,
    private alertService: AlertService,
    private aiAnalysisService: AiAnalysisService,
    @InjectRepository(VitalMetric)
    private vitalMetricRepository: Repository<VitalMetric>,
    private configService: ConfigService,
  ) {
    super();
    this.aiEnabled = this.configService.get('aiServices')?.enabled !== false;
  }

  async process(job: Job<MetricIngestedEvent>): Promise<void> {
    const event = job.data;
    this.logger.debug(`Processing metric event: ${event.metricId}`);

    try {
      // Evaluate alert rules
      const triggeredAlerts = this.alertRulesEngine.evaluate(event);

      // Create alerts for each triggered rule
      for (const alert of triggeredAlerts) {
        try {
          await this.alertService.createAlert({
            deviceId: event.deviceId,
            inmateDeviceId: event.inmateDeviceId,
            alertType: alert.alertType,
            severity: alert.severity,
            description: alert.description,
            explanation: alert.explanation, // Why alert triggered
            confidence: alert.confidence, // Confidence score
            alertData: alert.alertData,
            idempotencyKey: alert.idempotencyKey,
          });
        } catch (error) {
          this.logger.error(
            `Failed to create alert ${alert.alertType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
          );
          // Don't throw - continue processing other alerts
        }
      }

      this.logger.debug(
        `Processed metric event: ${event.metricId}, triggered ${triggeredAlerts.length} alerts`,
      );

      // AI Analysis (async, non-blocking)
      if (this.aiEnabled && event.metricType === 'vital') {
        this.performAiAnalysis(event).catch((error) => {
          this.logger.warn(
            `AI analysis failed for metric ${event.metricId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Don't throw - AI analysis is non-critical
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing metric event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Perform AI analysis on metric event (non-blocking).
   */
  private async performAiAnalysis(event: MetricIngestedEvent): Promise<void> {
    try {
      // Get recent metrics for time-series analysis (last 5 minutes, max 100 points)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentMetrics = await this.vitalMetricRepository.find({
        where: {
          deviceId: event.deviceId,
          recordedAt: MoreThan(fiveMinutesAgo),
        },
        order: {
          recordedAt: 'ASC',
        },
        take: 100,
      });

      if (recentMetrics.length === 0) {
        this.logger.debug(`No recent metrics found for AI analysis: ${event.metricId}`);
        return;
      }

      const currentMetric = recentMetrics[recentMetrics.length - 1];
      const recordedAt = new Date(event.data.recordedAt);

      // Prepare time-series data
      const timeSeriesData: Record<string, number[]> = {};
      const timestamps: string[] = [];

      recentMetrics.forEach((metric) => {
        if (metric.heartRate !== null) {
          if (!timeSeriesData.heart_rate) timeSeriesData.heart_rate = [];
          timeSeriesData.heart_rate.push(metric.heartRate);
        }
        if (metric.temperatureCelsius !== null) {
          if (!timeSeriesData.temperature) timeSeriesData.temperature = [];
          timeSeriesData.temperature.push(metric.temperatureCelsius);
        }
        if (metric.oxygenSaturation !== null) {
          if (!timeSeriesData.oxygen_saturation) timeSeriesData.oxygen_saturation = [];
          timeSeriesData.oxygen_saturation.push(metric.oxygenSaturation);
        }
        timestamps.push(metric.recordedAt.toISOString());
      });

      // 1. Anomaly Detection
      if (Object.keys(timeSeriesData).length > 0) {
        await this.aiAnalysisService.detectAnomalies(
          {
            device_id: event.deviceId,
            inmate_device_id: event.inmateDeviceId || undefined,
            time_series_data: timeSeriesData,
            timestamps,
            metadata: {
              metric_id: event.metricId,
            },
          },
          event.metricId,
          event.deviceId,
          event.inmateDeviceId,
          recordedAt,
        );
      }

      // 2. Risk Scoring (if we have current vital metrics)
      if (currentMetric && (currentMetric.heartRate || currentMetric.temperatureCelsius || currentMetric.oxygenSaturation)) {
        const vitalMetrics: Record<string, number> = {};
        if (currentMetric.heartRate !== null) vitalMetrics.heart_rate = currentMetric.heartRate;
        if (currentMetric.temperatureCelsius !== null) vitalMetrics.temperature = currentMetric.temperatureCelsius;
        if (currentMetric.oxygenSaturation !== null) vitalMetrics.oxygen_saturation = currentMetric.oxygenSaturation;

        // Get historical trends (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const historicalMetrics = await this.vitalMetricRepository.find({
          where: {
            deviceId: event.deviceId,
            recordedAt: MoreThan(oneHourAgo),
          },
          order: {
            recordedAt: 'ASC',
          },
        });

        const historicalTrends: Record<string, number[]> = {};
        historicalMetrics.forEach((metric) => {
          if (metric.heartRate !== null) {
            if (!historicalTrends.heart_rate) historicalTrends.heart_rate = [];
            historicalTrends.heart_rate.push(metric.heartRate);
          }
          if (metric.temperatureCelsius !== null) {
            if (!historicalTrends.temperature) historicalTrends.temperature = [];
            historicalTrends.temperature.push(metric.temperatureCelsius);
          }
        });

        await this.aiAnalysisService.calculateRiskScore(
          {
            device_id: event.deviceId,
            inmate_device_id: event.inmateDeviceId || undefined,
            vital_metrics: vitalMetrics,
            historical_trends: Object.keys(historicalTrends).length > 0 ? historicalTrends : undefined,
            time_window_hours: 1,
            metadata: {
              metric_id: event.metricId,
            },
          },
          event.metricId,
          event.deviceId,
          event.inmateDeviceId,
          recordedAt,
        );
      }

      this.logger.debug(`AI analysis completed for metric: ${event.metricId}`);
    } catch (error) {
      this.logger.error(
        `Error performing AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - AI analysis failures shouldn't break the pipeline
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
