/** Event types for the event pipeline. */

export enum EventType {
  METRIC_INGESTED = 'metric.ingested',
  ALERT_TRIGGERED = 'alert.triggered',
  ALERT_RESOLVED = 'alert.resolved',
}

export enum AlertType {
  HEART_RATE_HIGH = 'heart_rate_high',
  HEART_RATE_LOW = 'heart_rate_low',
  TEMPERATURE_HIGH = 'temperature_high',
  TEMPERATURE_LOW = 'temperature_low',
  OXYGEN_SATURATION_LOW = 'oxygen_saturation_low',
  BLOOD_PRESSURE_HIGH = 'blood_pressure_high',
  BLOOD_PRESSURE_LOW = 'blood_pressure_low',
  BATTERY_LOW = 'battery_low',
  SIGNAL_LOSS = 'signal_loss',
  DEVICE_DISCONNECTED = 'device_disconnected',
  DEVICE_TAMPER = 'device_tamper',
  PATTERN_ANOMALY = 'pattern_anomaly',
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}

export interface MetricIngestedEvent {
  type: EventType.METRIC_INGESTED;
  metricId: string;
  deviceId: string;
  inmateDeviceId: string | null;
  metricType: 'vital' | 'location' | 'status';
  data: {
    heartRate?: number | null;
    temperatureCelsius?: number | null;
    oxygenSaturation?: number | null;
    bloodPressureSystolic?: number | null;
    bloodPressureDiastolic?: number | null;
    batteryLevel?: number | null;
    signalStrength?: number | null;
    connectionStatus?: string;
    recordedAt: Date;
  };
  idempotencyKey: string;
  timestamp: Date;
}

export interface AlertTriggeredEvent {
  type: EventType.ALERT_TRIGGERED;
  alertId: string;
  deviceId: string;
  inmateDeviceId: string | null;
  alertType: AlertType;
  severity: Severity;
  description: string;
  alertData: Record<string, any>;
  timestamp: Date;
}

export type PipelineEvent = MetricIngestedEvent | AlertTriggeredEvent;
