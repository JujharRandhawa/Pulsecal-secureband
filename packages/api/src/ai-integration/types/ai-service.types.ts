/** Types for AI service integration. */

export interface SignalQualityRequest {
  device_id: string;
  signal_data: number[];
  sampling_rate: number;
  signal_type: 'ppg' | 'temperature' | 'imu';
  recorded_at: string;
  metadata?: Record<string, any>;
}

export interface SignalQualityResponse {
  model_version?: string;
  device_id: string;
  quality_score: number;
  quality_grade: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: {
    snr: number;
    rms_error: number;
    peak_detection_confidence: number;
    baseline_drift: number;
    motion_artifact_score: number;
  };
  is_usable: boolean;
  recommendations: string[];
  processed_at: string;
}

export interface AnomalyDetectionRequest {
  device_id: string;
  inmate_device_id?: string | null;
  time_series_data: Record<string, number[]>;
  timestamps: string[];
  baseline_stats?: Record<string, { mean: number; std: number }>;
  metadata?: Record<string, any>;
}

export interface AnomalyResult {
  anomaly_type: string;
  severity: number;
  confidence: number;
  description: string;
  detected_at: string;
  affected_metrics: string[];
  context?: Record<string, any>;
}

export interface AnomalyDetectionResponse {
  device_id: string;
  anomalies_detected: boolean;
  anomaly_count: number;
  anomalies: AnomalyResult[];
  overall_risk_score: number;
  processed_at: string;
  model_version?: string;
}

export interface RiskScoringRequest {
  device_id: string;
  inmate_device_id?: string | null;
  vital_metrics: Record<string, number>;
  historical_trends?: Record<string, number[]>;
  anomaly_flags?: string[];
  signal_quality_score?: number;
  time_window_hours: number;
  metadata?: Record<string, any>;
}

export interface RiskFactor {
  factor_name: string;
  factor_score: number;
  weight: number;
  description: string;
  evidence?: Record<string, any>;
}

export interface RiskScoringResponse {
  device_id: string;
  overall_risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  risk_factors: RiskFactor[];
  primary_concerns: string[];
  recommended_actions: string[];
  confidence: number;
  assessed_at: string;
  valid_until: string;
  model_version?: string;
}

export interface AiServiceError {
  message: string;
  statusCode?: number;
  details?: Record<string, any>;
}
