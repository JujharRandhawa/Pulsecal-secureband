/** HTTP client for AI microservices. */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import {
  SignalQualityRequest,
  SignalQualityResponse,
  AnomalyDetectionRequest,
  AnomalyDetectionResponse,
  RiskScoringRequest,
  RiskScoringResponse,
  AiServiceError,
} from '../types/ai-service.types';

@Injectable()
export class AiServiceClient {
  private readonly logger = new Logger(AiServiceClient.name);
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      process.env.AI_SERVICES_URL || 'http://localhost:8000';
    this.timeout = parseInt(
      process.env.AI_SERVICES_TIMEOUT || '10000',
      10,
    );
  }

  /**
   * Assess signal quality.
   */
  async assessSignalQuality(
    request: SignalQualityRequest,
  ): Promise<SignalQualityResponse> {
    const url = `${this.baseUrl}/api/v1/signal-quality`;
    this.logger.debug(`Calling signal quality API: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `AI service returned ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();
      return data as SignalQualityResponse;
    } catch (error) {
      this.logger.error(
        `Failed to assess signal quality: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw {
        message:
          error instanceof Error ? error.message : 'Unknown error',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : undefined,
        details: { request },
      } as AiServiceError;
    }
  }

  /**
   * Detect anomalies in time-series data.
   */
  async detectAnomalies(
    request: AnomalyDetectionRequest,
  ): Promise<AnomalyDetectionResponse> {
    const url = `${this.baseUrl}/api/v1/anomaly-detection`;
    this.logger.debug(`Calling anomaly detection API: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `AI service returned ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();
      return data as AnomalyDetectionResponse;
    } catch (error) {
      this.logger.error(
        `Failed to detect anomalies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw {
        message:
          error instanceof Error ? error.message : 'Unknown error',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : undefined,
        details: { request },
      } as AiServiceError;
    }
  }

  /**
   * Calculate risk score.
   */
  async calculateRiskScore(
    request: RiskScoringRequest,
  ): Promise<RiskScoringResponse> {
    const url = `${this.baseUrl}/api/v1/risk-scoring`;
    this.logger.debug(`Calling risk scoring API: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `AI service returned ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();
      return data as RiskScoringResponse;
    } catch (error) {
      this.logger.error(
        `Failed to calculate risk score: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw {
        message:
          error instanceof Error ? error.message : 'Unknown error',
        statusCode: error instanceof Error && 'status' in error ? (error as any).status : undefined,
        details: { request },
      } as AiServiceError;
    }
  }

  /**
   * Health check for AI services.
   */
  async healthCheck(): Promise<boolean> {
    const url = `${this.baseUrl}/api/v1/health`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      this.logger.warn(
        `AI service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
