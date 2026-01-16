// Common types for PulseCal SecureBand platform

// Placeholder for future type definitions
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Example structure - to be expanded
export type HealthMetricType = 'heart_rate' | 'temperature' | 'blood_pressure' | 'oxygen_saturation';

export interface HealthMetric {
  type: HealthMetricType;
  value: number;
  timestamp: Date;
  deviceId: string;
}
