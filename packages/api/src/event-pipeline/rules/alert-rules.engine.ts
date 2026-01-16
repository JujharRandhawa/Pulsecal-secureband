/**
 * Alert rules engine with configurable thresholds and confidence scoring.
 * 
 * Features:
 * - Configurable thresholds (no hardcoded values)
 * - Confidence scoring for each alert
 * - Explainable outputs (why alert triggered)
 * - Deterministic behavior
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AlertType,
  Severity,
  MetricIngestedEvent,
} from '../types/event.types';

export interface AlertRule {
  alertType: AlertType;
  condition: (data: MetricIngestedEvent['data']) => boolean;
  severity: (data: MetricIngestedEvent['data']) => Severity;
  confidence: (data: MetricIngestedEvent['data']) => number; // 0-1 confidence score
  description: (data: MetricIngestedEvent['data']) => string;
  explanation: (data: MetricIngestedEvent['data']) => string; // Why alert triggered
  idempotencyKey: (data: MetricIngestedEvent['data'], deviceId: string) => string;
}

/**
 * Configurable alert thresholds.
 * These can be overridden via environment variables or config service.
 */
export class AlertThresholds {
  // Heart Rate Thresholds (bpm)
  static HEART_RATE_NORMAL_MIN = parseFloat(process.env.ALERT_HR_NORMAL_MIN || '60');
  static HEART_RATE_NORMAL_MAX = parseFloat(process.env.ALERT_HR_NORMAL_MAX || '100');
  static HEART_RATE_WARNING_MIN = parseFloat(process.env.ALERT_HR_WARNING_MIN || '50');
  static HEART_RATE_WARNING_MAX = parseFloat(process.env.ALERT_HR_WARNING_MAX || '120');
  static HEART_RATE_CRITICAL_MIN = parseFloat(process.env.ALERT_HR_CRITICAL_MIN || '40');
  static HEART_RATE_CRITICAL_MAX = parseFloat(process.env.ALERT_HR_CRITICAL_MAX || '150');

  // Temperature Thresholds (°C)
  static TEMPERATURE_NORMAL_MIN = parseFloat(process.env.ALERT_TEMP_NORMAL_MIN || '36.1');
  static TEMPERATURE_NORMAL_MAX = parseFloat(process.env.ALERT_TEMP_NORMAL_MAX || '37.2');
  static TEMPERATURE_WARNING_MIN = parseFloat(process.env.ALERT_TEMP_WARNING_MIN || '35.5');
  static TEMPERATURE_WARNING_MAX = parseFloat(process.env.ALERT_TEMP_WARNING_MAX || '38.0');
  static TEMPERATURE_CRITICAL_MIN = parseFloat(process.env.ALERT_TEMP_CRITICAL_MIN || '34.0');
  static TEMPERATURE_CRITICAL_MAX = parseFloat(process.env.ALERT_TEMP_CRITICAL_MAX || '39.5');

  // Oxygen Saturation Thresholds (%)
  static OXYGEN_SATURATION_NORMAL_MIN = parseFloat(process.env.ALERT_SPO2_NORMAL_MIN || '95');
  static OXYGEN_SATURATION_WARNING_MIN = parseFloat(process.env.ALERT_SPO2_WARNING_MIN || '93');
  static OXYGEN_SATURATION_CRITICAL_MIN = parseFloat(process.env.ALERT_SPO2_CRITICAL_MIN || '90');

  // Blood Pressure Thresholds (mmHg)
  static BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX = parseFloat(process.env.ALERT_BP_SYSTOLIC_NORMAL_MAX || '140');
  static BLOOD_PRESSURE_SYSTOLIC_WARNING_MAX = parseFloat(process.env.ALERT_BP_SYSTOLIC_WARNING_MAX || '160');
  static BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MAX = parseFloat(process.env.ALERT_BP_SYSTOLIC_CRITICAL_MAX || '180');
  static BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN = parseFloat(process.env.ALERT_BP_SYSTOLIC_NORMAL_MIN || '90');
  static BLOOD_PRESSURE_SYSTOLIC_WARNING_MIN = parseFloat(process.env.ALERT_BP_SYSTOLIC_WARNING_MIN || '80');
  static BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MIN = parseFloat(process.env.ALERT_BP_SYSTOLIC_CRITICAL_MIN || '70');

  // Battery Thresholds (%)
  static BATTERY_WARNING = parseFloat(process.env.ALERT_BATTERY_WARNING || '20');
  static BATTERY_CRITICAL = parseFloat(process.env.ALERT_BATTERY_CRITICAL || '10');

  // Signal Strength Thresholds (dBm)
  static SIGNAL_STRENGTH_WARNING = parseFloat(process.env.ALERT_SIGNAL_WARNING || '-90');
  static SIGNAL_STRENGTH_CRITICAL = parseFloat(process.env.ALERT_SIGNAL_CRITICAL || '-100');

  // Confidence Thresholds
  static MIN_CONFIDENCE_FOR_ALERT = parseFloat(process.env.ALERT_MIN_CONFIDENCE || '0.6');
}

@Injectable()
export class AlertRulesEngine {
  private readonly logger = new Logger(AlertRulesEngine.name);
  private readonly rules: AlertRule[] = [];
  private readonly thresholds = AlertThresholds;

  constructor() {
    this.initializeRules();
  }

  /**
   * Evaluate all rules against the event data.
   * Returns alerts with confidence scores and explanations.
   */
  evaluate(event: MetricIngestedEvent): Array<{
    alertType: AlertType;
    severity: Severity;
    confidence: number;
    description: string;
    explanation: string;
    idempotencyKey: string;
    alertData: Record<string, any>;
  }> {
    const triggeredAlerts: Array<{
      alertType: AlertType;
      severity: Severity;
      confidence: number;
      description: string;
      explanation: string;
      idempotencyKey: string;
      alertData: Record<string, any>;
    }> = [];

    for (const rule of this.rules) {
      try {
        if (rule.condition(event.data)) {
          const confidence = rule.confidence(event.data);
          
          // Only trigger alert if confidence meets minimum threshold
          if (confidence < this.thresholds.MIN_CONFIDENCE_FOR_ALERT) {
            this.logger.debug(
              `Alert ${rule.alertType} triggered but confidence ${confidence.toFixed(2)} below threshold ${this.thresholds.MIN_CONFIDENCE_FOR_ALERT}`,
            );
            continue;
          }

          const idempotencyKey = rule.idempotencyKey(event.data, event.deviceId);
          triggeredAlerts.push({
            alertType: rule.alertType,
            severity: rule.severity(event.data),
            confidence,
            description: rule.description(event.data),
            explanation: rule.explanation(event.data),
            idempotencyKey,
            alertData: {
              metricId: event.metricId,
              deviceId: event.deviceId,
              inmateDeviceId: event.inmateDeviceId,
              recordedAt: event.data.recordedAt,
              confidence,
              explanation: rule.explanation(event.data),
              thresholds: this.getThresholdsForAlert(rule.alertType),
              ...event.data,
            },
          });
        }
      } catch (error) {
        this.logger.error(
          `Error evaluating rule ${rule.alertType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return triggeredAlerts;
  }

  /**
   * Get thresholds for a specific alert type (for explainability).
   */
  private getThresholdsForAlert(alertType: AlertType): Record<string, any> {
    switch (alertType) {
      case AlertType.HEART_RATE_HIGH:
      case AlertType.HEART_RATE_LOW:
        return {
          normal: `${this.thresholds.HEART_RATE_NORMAL_MIN}-${this.thresholds.HEART_RATE_NORMAL_MAX} bpm`,
          warning: `${this.thresholds.HEART_RATE_WARNING_MIN}-${this.thresholds.HEART_RATE_WARNING_MAX} bpm`,
          critical: `<${this.thresholds.HEART_RATE_CRITICAL_MIN} or >${this.thresholds.HEART_RATE_CRITICAL_MAX} bpm`,
        };
      case AlertType.TEMPERATURE_HIGH:
      case AlertType.TEMPERATURE_LOW:
        return {
          normal: `${this.thresholds.TEMPERATURE_NORMAL_MIN}-${this.thresholds.TEMPERATURE_NORMAL_MAX}°C`,
          warning: `${this.thresholds.TEMPERATURE_WARNING_MIN}-${this.thresholds.TEMPERATURE_WARNING_MAX}°C`,
          critical: `<${this.thresholds.TEMPERATURE_CRITICAL_MIN} or >${this.thresholds.TEMPERATURE_CRITICAL_MAX}°C`,
        };
      case AlertType.OXYGEN_SATURATION_LOW:
        return {
          normal: `>${this.thresholds.OXYGEN_SATURATION_NORMAL_MIN}%`,
          warning: `<${this.thresholds.OXYGEN_SATURATION_WARNING_MIN}%`,
          critical: `<${this.thresholds.OXYGEN_SATURATION_CRITICAL_MIN}%`,
        };
      case AlertType.BLOOD_PRESSURE_HIGH:
      case AlertType.BLOOD_PRESSURE_LOW:
        return {
          normal: `${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN}-${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX} mmHg`,
          warning: `${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_WARNING_MIN}-${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_WARNING_MAX} mmHg`,
          critical: `<${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MIN} or >${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MAX} mmHg`,
        };
      default:
        return {};
    }
  }

  /**
   * Calculate confidence score based on deviation from threshold.
   */
  private calculateConfidence(
    value: number,
    threshold: number,
    normalMin: number,
    normalMax: number,
    isHigh: boolean = true,
  ): number {
    // Base confidence
    let confidence = 0.7;

    // Higher confidence for larger deviations
    if (isHigh) {
      const deviation = value - threshold;
      const normalRange = normalMax - normalMin;
      const deviationRatio = deviation / normalRange;
      confidence = Math.min(1.0, 0.7 + deviationRatio * 0.3);
    } else {
      const deviation = threshold - value;
      const normalRange = normalMax - normalMin;
      const deviationRatio = deviation / normalRange;
      confidence = Math.min(1.0, 0.7 + deviationRatio * 0.3);
    }

    return confidence;
  }

  /**
   * Initialize alert rules with configurable thresholds.
   */
  private initializeRules(): void {
    // Heart rate high
    this.rules.push({
      alertType: AlertType.HEART_RATE_HIGH,
      condition: (data) => {
        return (
          data.heartRate !== null &&
          data.heartRate !== undefined &&
          data.heartRate > this.thresholds.HEART_RATE_NORMAL_MAX
        );
      },
      severity: (data) => {
        if (data.heartRate! > this.thresholds.HEART_RATE_CRITICAL_MAX) return Severity.CRITICAL;
        if (data.heartRate! > this.thresholds.HEART_RATE_WARNING_MAX) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        return this.calculateConfidence(
          data.heartRate!,
          this.thresholds.HEART_RATE_NORMAL_MAX,
          this.thresholds.HEART_RATE_NORMAL_MIN,
          this.thresholds.HEART_RATE_NORMAL_MAX,
          true,
        );
      },
      description: (data) =>
        `Elevated heart rate detected: ${data.heartRate} bpm`,
      explanation: (data) =>
        `Heart rate ${data.heartRate} bpm exceeds normal range (${this.thresholds.HEART_RATE_NORMAL_MIN}-${this.thresholds.HEART_RATE_NORMAL_MAX} bpm). ` +
        `Threshold exceeded by ${(data.heartRate! - this.thresholds.HEART_RATE_NORMAL_MAX).toFixed(1)} bpm.`,
      idempotencyKey: (data, deviceId) =>
        `hr_high_${deviceId}_${Math.floor(data.heartRate! / 10) * 10}`,
    });

    // Heart rate low
    this.rules.push({
      alertType: AlertType.HEART_RATE_LOW,
      condition: (data) => {
        return (
          data.heartRate !== null &&
          data.heartRate !== undefined &&
          data.heartRate < this.thresholds.HEART_RATE_NORMAL_MIN
        );
      },
      severity: (data) => {
        if (data.heartRate! < this.thresholds.HEART_RATE_CRITICAL_MIN) return Severity.CRITICAL;
        if (data.heartRate! < this.thresholds.HEART_RATE_WARNING_MIN) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        return this.calculateConfidence(
          data.heartRate!,
          this.thresholds.HEART_RATE_NORMAL_MIN,
          this.thresholds.HEART_RATE_NORMAL_MIN,
          this.thresholds.HEART_RATE_NORMAL_MAX,
          false,
        );
      },
      description: (data) =>
        `Low heart rate detected: ${data.heartRate} bpm`,
      explanation: (data) =>
        `Heart rate ${data.heartRate} bpm is below normal range (${this.thresholds.HEART_RATE_NORMAL_MIN}-${this.thresholds.HEART_RATE_NORMAL_MAX} bpm). ` +
        `Threshold exceeded by ${(this.thresholds.HEART_RATE_NORMAL_MIN - data.heartRate!).toFixed(1)} bpm.`,
      idempotencyKey: (data, deviceId) =>
        `hr_low_${deviceId}_${Math.floor(data.heartRate! / 10) * 10}`,
    });

    // Temperature high
    this.rules.push({
      alertType: AlertType.TEMPERATURE_HIGH,
      condition: (data) => {
        return (
          data.temperatureCelsius !== null &&
          data.temperatureCelsius !== undefined &&
          data.temperatureCelsius > this.thresholds.TEMPERATURE_NORMAL_MAX
        );
      },
      severity: (data) => {
        if (data.temperatureCelsius! > this.thresholds.TEMPERATURE_CRITICAL_MAX) return Severity.CRITICAL;
        if (data.temperatureCelsius! > this.thresholds.TEMPERATURE_WARNING_MAX) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        return this.calculateConfidence(
          data.temperatureCelsius!,
          this.thresholds.TEMPERATURE_NORMAL_MAX,
          this.thresholds.TEMPERATURE_NORMAL_MIN,
          this.thresholds.TEMPERATURE_NORMAL_MAX,
          true,
        );
      },
      description: (data) =>
        `Elevated temperature detected: ${data.temperatureCelsius}°C`,
      explanation: (data) =>
        `Temperature ${data.temperatureCelsius}°C exceeds normal range (${this.thresholds.TEMPERATURE_NORMAL_MIN}-${this.thresholds.TEMPERATURE_NORMAL_MAX}°C). ` +
        `Threshold exceeded by ${(data.temperatureCelsius! - this.thresholds.TEMPERATURE_NORMAL_MAX).toFixed(2)}°C.`,
      idempotencyKey: (data, deviceId) =>
        `temp_high_${deviceId}_${Math.floor(data.temperatureCelsius! * 10) / 10}`,
    });

    // Temperature low
    this.rules.push({
      alertType: AlertType.TEMPERATURE_LOW,
      condition: (data) => {
        return (
          data.temperatureCelsius !== null &&
          data.temperatureCelsius !== undefined &&
          data.temperatureCelsius < this.thresholds.TEMPERATURE_NORMAL_MIN
        );
      },
      severity: (data) => {
        if (data.temperatureCelsius! < this.thresholds.TEMPERATURE_CRITICAL_MIN) return Severity.CRITICAL;
        if (data.temperatureCelsius! < this.thresholds.TEMPERATURE_WARNING_MIN) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        return this.calculateConfidence(
          data.temperatureCelsius!,
          this.thresholds.TEMPERATURE_NORMAL_MIN,
          this.thresholds.TEMPERATURE_NORMAL_MIN,
          this.thresholds.TEMPERATURE_NORMAL_MAX,
          false,
        );
      },
      description: (data) =>
        `Low temperature detected: ${data.temperatureCelsius}°C`,
      explanation: (data) =>
        `Temperature ${data.temperatureCelsius}°C is below normal range (${this.thresholds.TEMPERATURE_NORMAL_MIN}-${this.thresholds.TEMPERATURE_NORMAL_MAX}°C). ` +
        `Threshold exceeded by ${(this.thresholds.TEMPERATURE_NORMAL_MIN - data.temperatureCelsius!).toFixed(2)}°C.`,
      idempotencyKey: (data, deviceId) =>
        `temp_low_${deviceId}_${Math.floor(data.temperatureCelsius! * 10) / 10}`,
    });

    // Oxygen saturation low
    this.rules.push({
      alertType: AlertType.OXYGEN_SATURATION_LOW,
      condition: (data) => {
        return (
          data.oxygenSaturation !== null &&
          data.oxygenSaturation !== undefined &&
          data.oxygenSaturation < this.thresholds.OXYGEN_SATURATION_NORMAL_MIN
        );
      },
      severity: (data) => {
        if (data.oxygenSaturation! < this.thresholds.OXYGEN_SATURATION_CRITICAL_MIN) return Severity.CRITICAL;
        if (data.oxygenSaturation! < this.thresholds.OXYGEN_SATURATION_WARNING_MIN) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        const deviation = this.thresholds.OXYGEN_SATURATION_NORMAL_MIN - data.oxygenSaturation!;
        return Math.min(1.0, 0.7 + (deviation / 10) * 0.3); // Higher confidence for larger deviations
      },
      description: (data) =>
        `Low oxygen saturation: ${data.oxygenSaturation}%`,
      explanation: (data) =>
        `Oxygen saturation ${data.oxygenSaturation}% is below normal threshold (${this.thresholds.OXYGEN_SATURATION_NORMAL_MIN}%). ` +
        `Threshold exceeded by ${(this.thresholds.OXYGEN_SATURATION_NORMAL_MIN - data.oxygenSaturation!).toFixed(1)}%.`,
      idempotencyKey: (data, deviceId) =>
        `spo2_low_${deviceId}_${Math.floor(data.oxygenSaturation! / 5) * 5}`,
    });

    // Blood pressure high
    this.rules.push({
      alertType: AlertType.BLOOD_PRESSURE_HIGH,
      condition: (data) => {
        return (
          data.bloodPressureSystolic !== null &&
          data.bloodPressureSystolic !== undefined &&
          data.bloodPressureSystolic > this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX
        );
      },
      severity: (data) => {
        if (data.bloodPressureSystolic! > this.thresholds.BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MAX) return Severity.CRITICAL;
        if (data.bloodPressureSystolic! > this.thresholds.BLOOD_PRESSURE_SYSTOLIC_WARNING_MAX) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        return this.calculateConfidence(
          data.bloodPressureSystolic!,
          this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX,
          this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN,
          this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX,
          true,
        );
      },
      description: (data) =>
        `High blood pressure: ${data.bloodPressureSystolic}/${data.bloodPressureDiastolic} mmHg`,
      explanation: (data) =>
        `Systolic blood pressure ${data.bloodPressureSystolic} mmHg exceeds normal threshold (${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX} mmHg). ` +
        `Threshold exceeded by ${(data.bloodPressureSystolic! - this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX).toFixed(0)} mmHg.`,
      idempotencyKey: (data, deviceId) =>
        `bp_high_${deviceId}_${Math.floor(data.bloodPressureSystolic! / 10) * 10}`,
    });

    // Blood pressure low
    this.rules.push({
      alertType: AlertType.BLOOD_PRESSURE_LOW,
      condition: (data) => {
        return (
          data.bloodPressureSystolic !== null &&
          data.bloodPressureSystolic !== undefined &&
          data.bloodPressureSystolic < this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN
        );
      },
      severity: (data) => {
        if (data.bloodPressureSystolic! < this.thresholds.BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MIN) return Severity.CRITICAL;
        if (data.bloodPressureSystolic! < this.thresholds.BLOOD_PRESSURE_SYSTOLIC_WARNING_MIN) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        return this.calculateConfidence(
          data.bloodPressureSystolic!,
          this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN,
          this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN,
          this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX,
          false,
        );
      },
      description: (data) =>
        `Low blood pressure: ${data.bloodPressureSystolic}/${data.bloodPressureDiastolic} mmHg`,
      explanation: (data) =>
        `Systolic blood pressure ${data.bloodPressureSystolic} mmHg is below normal threshold (${this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN} mmHg). ` +
        `Threshold exceeded by ${(this.thresholds.BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN - data.bloodPressureSystolic!).toFixed(0)} mmHg.`,
      idempotencyKey: (data, deviceId) =>
        `bp_low_${deviceId}_${Math.floor(data.bloodPressureSystolic! / 10) * 10}`,
    });

    // Battery low
    this.rules.push({
      alertType: AlertType.BATTERY_LOW,
      condition: (data) => {
        return (
          data.batteryLevel !== null &&
          data.batteryLevel !== undefined &&
          data.batteryLevel < this.thresholds.BATTERY_WARNING
        );
      },
      severity: (data) => {
        if (data.batteryLevel! < this.thresholds.BATTERY_CRITICAL) return Severity.HIGH;
        if (data.batteryLevel! < this.thresholds.BATTERY_WARNING) return Severity.MEDIUM;
        return Severity.LOW;
      },
      confidence: (data) => {
        // Higher confidence as battery gets lower
        const deviation = this.thresholds.BATTERY_WARNING - data.batteryLevel!;
        return Math.min(1.0, 0.8 + (deviation / 20) * 0.2);
      },
      description: (data) => `Low battery level: ${data.batteryLevel}%`,
      explanation: (data) =>
        `Battery level ${data.batteryLevel}% is below warning threshold (${this.thresholds.BATTERY_WARNING}%). ` +
        `${data.batteryLevel! < this.thresholds.BATTERY_CRITICAL ? 'CRITICAL: ' : ''}Device may lose power soon.`,
      idempotencyKey: (data, deviceId) =>
        `battery_low_${deviceId}_${Math.floor(data.batteryLevel! / 10) * 10}`,
    });

    // Device disconnected
    this.rules.push({
      alertType: AlertType.DEVICE_DISCONNECTED,
      condition: (data) => {
        return data.connectionStatus === 'disconnected';
      },
      severity: () => Severity.HIGH,
      confidence: () => 1.0, // High confidence for connection status
      description: () => 'Device disconnected from gateway',
      explanation: () =>
        'Device connection status is "disconnected". Device is not communicating with the gateway.',
      idempotencyKey: (_, deviceId) => `device_disconnected_${deviceId}`,
    });

    // Signal loss
    this.rules.push({
      alertType: AlertType.SIGNAL_LOSS,
      condition: (data) => {
        return (
          data.signalStrength !== null &&
          data.signalStrength !== undefined &&
          data.signalStrength < this.thresholds.SIGNAL_STRENGTH_WARNING
        );
      },
      severity: (data) => {
        if (data.signalStrength! < this.thresholds.SIGNAL_STRENGTH_CRITICAL) return Severity.HIGH;
        return Severity.MEDIUM;
      },
      confidence: (data) => {
        // Higher confidence for weaker signals
        const deviation = this.thresholds.SIGNAL_STRENGTH_WARNING - data.signalStrength!;
        return Math.min(1.0, 0.7 + (deviation / 20) * 0.3);
      },
      description: (data) =>
        `Weak signal strength: ${data.signalStrength} dBm`,
      explanation: (data) =>
        `Signal strength ${data.signalStrength} dBm is below warning threshold (${this.thresholds.SIGNAL_STRENGTH_WARNING} dBm). ` +
        `Weak signal may cause data loss or connection issues.`,
      idempotencyKey: (data, deviceId) =>
        `signal_loss_${deviceId}_${Math.floor(data.signalStrength! / 10) * 10}`,
    });
  }
}
