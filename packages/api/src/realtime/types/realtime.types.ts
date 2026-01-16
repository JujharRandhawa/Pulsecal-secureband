/** WebSocket event types for real-time updates. */

export enum RealtimeEvent {
  // Client events
  SUBSCRIBE_VITALS = 'subscribe:vitals',
  UNSUBSCRIBE_VITALS = 'unsubscribe:vitals',
  SUBSCRIBE_ALERTS = 'subscribe:alerts',
  UNSUBSCRIBE_ALERTS = 'unsubscribe:alerts',
  SUBSCRIBE_DEVICE_STATUS = 'subscribe:device-status',
  UNSUBSCRIBE_DEVICE_STATUS = 'unsubscribe:device-status',

  // Server events
  VITAL_METRIC = 'vital:metric',
  ALERT_CREATED = 'alert:created',
  ALERT_UPDATED = 'alert:updated',
  DEVICE_STATUS = 'device:status',
  CONNECTION_STATUS = 'connection:status',
}

export interface VitalMetricEvent {
  deviceId: string;
  inmateDeviceId: string | null;
  metricId: string;
  heartRate: number | null;
  temperatureCelsius: number | null;
  oxygenSaturation: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  recordedAt: string;
}

export interface AlertEvent {
  alertId: string;
  deviceId: string;
  inmateDeviceId: string | null;
  alertType: string;
  severity: string;
  status: string;
  description: string;
  triggeredAt: string;
}

export interface DeviceStatusEvent {
  deviceId: string;
  connectionStatus: string;
  batteryLevel: number | null;
  signalStrength: number | null;
  recordedAt: string;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  timestamp: string;
  message?: string;
}
