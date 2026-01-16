# AI Models Production Integration

This document describes how the production-ready AI models are integrated into the API layer.

## Overview

The API integrates with the AI services to:
- Trigger AI analysis on ingested metrics
- Store AI analysis results separately from raw data
- Create alerts with confidence scores and explanations
- Track model versions for all analyses

## Model Versioning

### Model Version Storage

All AI analyses store the model version used:

```typescript
// In ai_analyses table
{
  modelVersion: "anomaly-detection-v1.0.0",
  analysisType: "anomaly_detection",
  results: { ... },
  evidence: {
    modelVersion: "anomaly-detection-v1.0.0",
    ...
  }
}
```

### Version Tracking

- **Database**: `ai_analyses.model_version` column
- **Evidence**: `ai_analyses.evidence.modelVersion` (for detailed tracking)
- **Alerts**: `alerts.alertData.modelVersion` (if alert from AI analysis)

## Alert Confidence Scoring

### Confidence in Alerts

All alerts now include confidence scores:

```typescript
// Alert entity
{
  confidence: 0.85,  // 0-1 confidence score
  explanation: "Heart rate 130 bpm exceeds normal range...",
  alertData: {
    confidence: 0.85,
    explanation: "...",
    thresholds: { ... }
  }
}
```

### Confidence Calculation

Confidence is calculated by the `AlertRulesEngine`:

1. **Base confidence**: 0.7 (for threshold-based alerts)
2. **Deviation bonus**: Larger deviations increase confidence
3. **Minimum threshold**: Alerts below `ALERT_MIN_CONFIDENCE` (0.6) are not created

### Confidence-Based Filtering

```typescript
// In AlertRulesEngine.evaluate()
if (confidence < this.thresholds.MIN_CONFIDENCE_FOR_ALERT) {
  // Skip alert - confidence too low
  continue;
}
```

## Explainable Outputs

### Alert Explanations

Every alert includes an `explanation` field:

```typescript
{
  description: "Elevated heart rate detected: 130 bpm",
  explanation: "Heart rate 130 bpm exceeds normal range (60-100 bpm). Threshold exceeded by 30.0 bpm.",
  alertData: {
    thresholds: {
      normal: "60-100 bpm",
      warning: "50-120 bpm",
      critical: "<40 or >150 bpm"
    }
  }
}
```

### AI Analysis Explanations

AI analyses include:

1. **Anomaly Detection**:
   - Description of each anomaly
   - Z-score and baseline comparison
   - Affected metrics

2. **Risk Scoring**:
   - Primary concerns (top 3)
   - Risk factors with scores
   - Recommended actions

3. **Signal Quality**:
   - Quality grade and score
   - Specific recommendations
   - Metric breakdown

## Configurable Thresholds

### Environment Variables

All thresholds are configurable via environment variables:

```bash
# Heart Rate
ALERT_HR_NORMAL_MIN=60
ALERT_HR_NORMAL_MAX=100
ALERT_HR_WARNING_MIN=50
ALERT_HR_WARNING_MAX=120
ALERT_HR_CRITICAL_MIN=40
ALERT_HR_CRITICAL_MAX=150

# Temperature
ALERT_TEMP_NORMAL_MIN=36.1
ALERT_TEMP_NORMAL_MAX=37.2
ALERT_TEMP_WARNING_MIN=35.5
ALERT_TEMP_WARNING_MAX=38.0
ALERT_TEMP_CRITICAL_MIN=34.0
ALERT_TEMP_CRITICAL_MAX=39.5

# Oxygen Saturation
ALERT_SPO2_NORMAL_MIN=95
ALERT_SPO2_WARNING_MIN=93
ALERT_SPO2_CRITICAL_MIN=90

# Blood Pressure
ALERT_BP_SYSTOLIC_NORMAL_MAX=140
ALERT_BP_SYSTOLIC_WARNING_MAX=160
ALERT_BP_SYSTOLIC_CRITICAL_MAX=180
ALERT_BP_SYSTOLIC_NORMAL_MIN=90
ALERT_BP_SYSTOLIC_WARNING_MIN=80
ALERT_BP_SYSTOLIC_CRITICAL_MIN=70

# Battery & Signal
ALERT_BATTERY_WARNING=20
ALERT_BATTERY_CRITICAL=10
ALERT_SIGNAL_WARNING=-90
ALERT_SIGNAL_CRITICAL=-100

# Confidence
ALERT_MIN_CONFIDENCE=0.6
```

### Threshold Usage

Thresholds are loaded at service startup:

```typescript
// In AlertRulesEngine
private readonly thresholds = AlertThresholds;

// Thresholds are static and read from environment
static HEART_RATE_NORMAL_MAX = parseFloat(
  process.env.ALERT_HR_NORMAL_MAX || '100'
);
```

## Data Flow

### Complete Flow

```
1. Metric ingested (raw sensor data)
   ↓
2. Stored in vital_metrics/location_metrics/device_status
   ↓
3. Event published to event pipeline
   ↓
4. MetricProcessor processes event:
   a. AlertRulesEngine evaluates rules
      - Checks thresholds
      - Calculates confidence
      - Generates explanation
      - Filters by confidence
   b. AlertService creates alerts
      - Stores confidence
      - Stores explanation
      - Stores thresholds used
   c. AiAnalysisService triggers AI analysis
      - Calls AI services
      - Stores results in ai_analyses
      - Stores model version
   ↓
5. Results stored:
   - Raw data: vital_metrics (separate from AI)
   - AI analysis: ai_analyses (with model version)
   - Alerts: alerts (with confidence & explanation)
```

## Alert Creation

### Alert with Confidence

```typescript
await alertService.createAlert({
  deviceId: "dev-001",
  alertType: AlertType.HEART_RATE_HIGH,
  severity: Severity.HIGH,
  description: "Elevated heart rate detected: 130 bpm",
  explanation: "Heart rate 130 bpm exceeds normal range (60-100 bpm). Threshold exceeded by 30.0 bpm.",
  confidence: 0.85,
  alertData: {
    heartRate: 130,
    thresholds: { ... },
    explanation: "...",
    confidence: 0.85
  },
  idempotencyKey: "hr_high_dev-001_130"
});
```

## AI Analysis Storage

### Separate from Raw Data

Raw sensor data and AI inferences are stored separately:

```typescript
// Raw data (vital_metrics)
{
  deviceId: "dev-001",
  recordedAt: "2026-01-15T10:30:00Z",
  heartRate: 130,
  temperatureCelsius: 37.5,
  // No AI analysis data here
}

// AI analysis (ai_analyses) - Separate table
{
  metricId: "metric-123",  // Reference to raw metric
  analysisType: "anomaly_detection",
  modelVersion: "anomaly-detection-v1.0.0",
  results: {
    anomaliesDetected: true,
    anomalies: [ ... ],
    overallRiskScore: 0.75
  },
  explanation: "Detected 2 anomalies...",
  confidence: 0.92
}
```

## Deterministic Behavior

### Fixed Behavior

- **No randomness**: All calculations are deterministic
- **Fixed thresholds**: Loaded from config, not random
- **Reproducible**: Same input = same output
- **No training**: Inference-only, no model updates

### Verification

To verify deterministic behavior:

1. Send same metric twice
2. Check that alerts are identical
3. Check that AI analysis results are identical
4. Verify model version is consistent

## Error Handling

### Graceful Degradation

If AI services fail:

1. **Fallback logic**: Basic threshold-based detection
2. **Lower confidence**: Fallback alerts have confidence 0.3-0.5
3. **Status tracking**: `analysis.status = AnalysisStatus.FALLBACK`
4. **Reason logging**: `fallbackReason` field explains why

### Fallback Example

```typescript
{
  status: "fallback",
  usedFallback: true,
  fallbackReason: "AI service unavailable",
  confidence: 0.4,  // Lower confidence
  explanation: "Fallback assessment: Basic quality score 0.65 (AI service unavailable)"
}
```

## Monitoring

### Key Metrics

1. **Model version distribution**: Track which versions are used
2. **Confidence distribution**: Average confidence scores
3. **Alert rate by confidence**: How many alerts filtered by confidence
4. **Fallback rate**: How often fallback is used
5. **Explanation quality**: User feedback on explanations

### Logging

All AI operations log:
- Model version used
- Confidence scores
- Thresholds applied
- Explanations generated

## Testing

### Test Scenarios

1. **Threshold changes**: Verify alerts trigger at new thresholds
2. **Confidence filtering**: Verify low-confidence alerts are filtered
3. **Explanation generation**: Verify explanations are clear and accurate
4. **Model versioning**: Verify correct model version is used
5. **Deterministic behavior**: Verify same input = same output

---

**Last Updated**: 2026-01-15
**Version**: 1.0.0
