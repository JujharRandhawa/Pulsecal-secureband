/** Service for managing AI analysis results. */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAnalysis, AnalysisType, AnalysisStatus } from '../../entities/ai-analysis.entity';
import { AiServiceClient } from './ai-service-client.service';
import {
  SignalQualityRequest,
  AnomalyDetectionRequest,
  RiskScoringRequest,
  AiServiceError,
} from '../types/ai-service.types';

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    @InjectRepository(AiAnalysis)
    private aiAnalysisRepository: Repository<AiAnalysis>,
    private aiServiceClient: AiServiceClient,
  ) {}

  /**
   * Analyze signal quality with fallback.
   */
  async analyzeSignalQuality(
    request: SignalQualityRequest,
    metricId: string,
    deviceId: string,
    inmateDeviceId: string | null,
    recordedAt: Date,
  ): Promise<AiAnalysis> {
    const analysis = this.aiAnalysisRepository.create({
      deviceId,
      inmateDeviceId,
      analysisType: AnalysisType.SIGNAL_QUALITY,
      status: AnalysisStatus.PENDING,
      metricId,
      recordedAt,
      analyzedAt: new Date(),
      modelVersion: null, // Will be set from response
    });

    try {
      const response = await this.aiServiceClient.assessSignalQuality(request);

      analysis.status = AnalysisStatus.COMPLETED;
      analysis.results = {
        qualityScore: response.quality_score,
        qualityGrade: response.quality_grade,
        metrics: response.metrics,
        isUsable: response.is_usable,
      };
      analysis.explanation = `Signal quality: ${response.quality_grade} (score: ${response.quality_score.toFixed(2)})`;
      analysis.recommendations = response.recommendations;
      analysis.confidence = response.metrics.peak_detection_confidence;
      analysis.qualityScore = response.quality_score;
      analysis.modelVersion = response.model_version || null; // Store model version
      analysis.evidence = {
        snr: response.metrics.snr,
        rmsError: response.metrics.rms_error,
        baselineDrift: response.metrics.baseline_drift,
        motionArtifactScore: response.metrics.motion_artifact_score,
        modelVersion: response.model_version, // Store model version
      };

      this.logger.debug(
        `Signal quality analysis completed for device ${deviceId}: ${response.quality_grade}`,
      );
    } catch (error) {
      this.logger.warn(
        `AI service failed, using fallback for signal quality: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fallback: Basic quality assessment based on signal data
      const fallbackScore = this.fallbackSignalQuality(request.signal_data);
      analysis.status = AnalysisStatus.FALLBACK;
      analysis.usedFallback = true;
      analysis.fallbackReason = error instanceof Error ? error.message : 'AI service unavailable';
      analysis.results = {
        qualityScore: fallbackScore,
        qualityGrade: fallbackScore > 0.7 ? 'good' : fallbackScore > 0.5 ? 'fair' : 'poor',
        isUsable: fallbackScore > 0.5,
      };
      analysis.explanation = `Fallback assessment: Basic quality score ${fallbackScore.toFixed(2)} (AI service unavailable)`;
      analysis.recommendations = ['Verify signal quality manually', 'Check device connection'];
      analysis.confidence = 0.5; // Lower confidence for fallback
      analysis.qualityScore = fallbackScore;
      analysis.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      analysis.errorDetails = (error as AiServiceError).details;
    }

    return this.aiAnalysisRepository.save(analysis);
  }

  /**
   * Detect anomalies with fallback.
   */
  async detectAnomalies(
    request: AnomalyDetectionRequest,
    metricId: string,
    deviceId: string,
    inmateDeviceId: string | null,
    recordedAt: Date,
  ): Promise<AiAnalysis> {
    const analysis = this.aiAnalysisRepository.create({
      deviceId,
      inmateDeviceId,
      analysisType: AnalysisType.ANOMALY_DETECTION,
      status: AnalysisStatus.PENDING,
      metricId,
      recordedAt,
      analyzedAt: new Date(),
      modelVersion: null, // Will be set from response
    });

    try {
      const response = await this.aiServiceClient.detectAnomalies(request);

      analysis.status = AnalysisStatus.COMPLETED;
      analysis.results = {
        anomaliesDetected: response.anomalies_detected,
        anomalyCount: response.anomaly_count,
        anomalies: response.anomalies,
        overallRiskScore: response.overall_risk_score,
      };
      analysis.explanation = response.anomalies_detected
        ? `Detected ${response.anomaly_count} anomaly(ies) with overall risk score ${response.overall_risk_score.toFixed(2)}`
        : 'No anomalies detected';
      analysis.recommendations = response.anomalies.map(
        (a) => a.description,
      );
      analysis.confidence = response.anomalies.length > 0
        ? response.anomalies.reduce((sum, a) => sum + a.confidence, 0) / response.anomalies.length
        : 1.0;
      analysis.modelVersion = response.model_version || null; // Store model version
      analysis.evidence = {
        anomalies: response.anomalies.map((a) => ({
          type: a.anomaly_type,
          severity: a.severity,
          affectedMetrics: a.affected_metrics,
          context: a.context,
        })),
        modelVersion: response.model_version, // Store model version
      };

      this.logger.debug(
        `Anomaly detection completed for device ${deviceId}: ${response.anomaly_count} anomalies`,
      );
    } catch (error) {
      this.logger.warn(
        `AI service failed, using fallback for anomaly detection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fallback: Basic threshold-based anomaly detection
      const fallbackAnomalies = this.fallbackAnomalyDetection(request);
      analysis.status = AnalysisStatus.FALLBACK;
      analysis.usedFallback = true;
      analysis.fallbackReason = error instanceof Error ? error.message : 'AI service unavailable';
      analysis.results = {
        anomaliesDetected: fallbackAnomalies.length > 0,
        anomalyCount: fallbackAnomalies.length,
        anomalies: fallbackAnomalies,
        overallRiskScore: fallbackAnomalies.length > 0 ? 0.5 : 0.0,
      };
      analysis.explanation = fallbackAnomalies.length > 0
        ? `Fallback detection: ${fallbackAnomalies.length} potential anomaly(ies) (AI service unavailable)`
        : 'Fallback detection: No anomalies detected (AI service unavailable)';
      analysis.recommendations = ['Verify anomalies manually', 'Check device status'];
      analysis.confidence = 0.4; // Lower confidence for fallback
      analysis.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      analysis.errorDetails = (error as AiServiceError).details;
    }

    return this.aiAnalysisRepository.save(analysis);
  }

  /**
   * Calculate risk score with fallback.
   */
  async calculateRiskScore(
    request: RiskScoringRequest,
    metricId: string,
    deviceId: string,
    inmateDeviceId: string | null,
    recordedAt: Date,
  ): Promise<AiAnalysis> {
    const analysis = this.aiAnalysisRepository.create({
      deviceId,
      inmateDeviceId,
      analysisType: AnalysisType.RISK_SCORING,
      status: AnalysisStatus.PENDING,
      metricId,
      recordedAt,
      analyzedAt: new Date(),
      modelVersion: null, // Will be set from response
    });

    try {
      const response = await this.aiServiceClient.calculateRiskScore(request);

      analysis.status = AnalysisStatus.COMPLETED;
      analysis.results = {
        overallRiskScore: response.overall_risk_score,
        riskLevel: response.risk_level,
        riskFactors: response.risk_factors,
        primaryConcerns: response.primary_concerns,
        recommendedActions: response.recommended_actions,
        validUntil: response.valid_until,
      };
      analysis.explanation = `Risk level: ${response.risk_level} (score: ${response.overall_risk_score.toFixed(2)})`;
      analysis.recommendations = response.recommended_actions;
      analysis.confidence = response.confidence;
      analysis.modelVersion = response.model_version || null; // Store model version
      analysis.evidence = {
        riskFactors: response.risk_factors.map((f) => ({
          name: f.factor_name,
          score: f.factor_score,
          weight: f.weight,
          description: f.description,
          evidence: f.evidence,
        })),
        primaryConcerns: response.primary_concerns,
        modelVersion: response.model_version, // Store model version
      };

      this.logger.debug(
        `Risk scoring completed for device ${deviceId}: ${response.risk_level} (${response.overall_risk_score.toFixed(2)})`,
      );
    } catch (error) {
      this.logger.warn(
        `AI service failed, using fallback for risk scoring: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fallback: Basic risk scoring based on vital metrics
      const fallbackScore = this.fallbackRiskScoring(request.vital_metrics);
      analysis.status = AnalysisStatus.FALLBACK;
      analysis.usedFallback = true;
      analysis.fallbackReason = error instanceof Error ? error.message : 'AI service unavailable';
      analysis.results = {
        overallRiskScore: fallbackScore,
        riskLevel: this.getRiskLevel(fallbackScore),
        riskFactors: [],
        primaryConcerns: ['AI service unavailable - manual review recommended'],
        recommendedActions: ['Monitor closely', 'Verify metrics manually'],
      };
      analysis.explanation = `Fallback risk score: ${fallbackScore.toFixed(2)} (AI service unavailable)`;
      analysis.recommendations = ['Verify risk assessment manually', 'Check device status'];
      analysis.confidence = 0.3; // Lower confidence for fallback
      analysis.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      analysis.errorDetails = (error as AiServiceError).details;
    }

    return this.aiAnalysisRepository.save(analysis);
  }

  /**
   * Fallback: Basic signal quality assessment.
   */
  private fallbackSignalQuality(signalData: number[]): number {
    if (signalData.length === 0) return 0.0;

    // Calculate basic statistics
    const mean = signalData.reduce((a, b) => a + b, 0) / signalData.length;
    const variance = signalData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signalData.length;
    const stdDev = Math.sqrt(variance);

    // Simple quality score based on variance (lower variance = higher quality)
    const normalizedVariance = Math.min(stdDev / mean, 1.0);
    return Math.max(0, 1.0 - normalizedVariance);
  }

  /**
   * Fallback: Basic threshold-based anomaly detection.
   */
  private fallbackAnomalyDetection(request: AnomalyDetectionRequest): Array<{
    anomaly_type: string;
    severity: number;
    confidence: number;
    description: string;
    detected_at: string;
    affected_metrics: string[];
  }> {
    const anomalies: Array<{
      anomaly_type: string;
      severity: number;
      confidence: number;
      description: string;
      detected_at: string;
      affected_metrics: string[];
    }> = [];

    // Basic threshold checks
    const thresholds: Record<string, { min: number; max: number }> = {
      heart_rate: { min: 40, max: 180 },
      temperature: { min: 35.0, max: 40.0 },
      oxygen_saturation: { min: 90, max: 100 },
    };

    for (const [metric, values] of Object.entries(request.time_series_data)) {
      const threshold = thresholds[metric.toLowerCase()];
      if (!threshold) continue;

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value < threshold.min || value > threshold.max) {
          anomalies.push({
            anomaly_type: `${metric}_abnormal`,
            severity: value < threshold.min * 0.8 || value > threshold.max * 1.2 ? 0.8 : 0.5,
            confidence: 0.6,
            description: `${metric} out of normal range: ${value} (expected: ${threshold.min}-${threshold.max})`,
            detected_at: request.timestamps[i] || new Date().toISOString(),
            affected_metrics: [metric],
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Fallback: Basic risk scoring.
   */
  private fallbackRiskScoring(vitalMetrics: Record<string, number>): number {
    let riskScore = 0.0;
    let factorCount = 0;

    // Heart rate check
    if (vitalMetrics.heart_rate) {
      const hr = vitalMetrics.heart_rate;
      if (hr < 50 || hr > 120) {
        riskScore += 0.4;
        factorCount++;
      } else if (hr < 60 || hr > 100) {
        riskScore += 0.2;
        factorCount++;
      }
    }

    // Temperature check
    if (vitalMetrics.temperature) {
      const temp = vitalMetrics.temperature;
      if (temp < 36.0 || temp > 38.0) {
        riskScore += 0.3;
        factorCount++;
      }
    }

    // Oxygen saturation check
    if (vitalMetrics.oxygen_saturation) {
      const spo2 = vitalMetrics.oxygen_saturation;
      if (spo2 < 95) {
        riskScore += 0.3;
        factorCount++;
      }
    }

    // Normalize score
    return factorCount > 0 ? Math.min(riskScore / factorCount, 1.0) : 0.0;
  }

  /**
   * Get risk level from score.
   */
  private getRiskLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'moderate';
    return 'low';
  }
}
