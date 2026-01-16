# AI Models Production Guide

This document describes the production-ready AI model system with fixed, versioned models, configurable thresholds, and explainable outputs.

## Overview

The AI models are:
- **Fixed and versioned** - No on-device training, inference-only
- **Deterministic** - Fixed random seeds, reproducible results
- **Configurable** - All thresholds can be adjusted via configuration
- **Explainable** - Every alert includes an explanation of why it triggered
- **Confidence-scored** - All alerts include confidence scores

## Model Versioning

### Model Registry

All models are registered in `app/config/model_config.py`:

```python
MODEL_REGISTRY = {
    ModelVersion.SIGNAL_QUALITY_V1: ModelConfig(...),
    ModelVersion.ANOMALY_DETECTION_V1: ModelConfig(...),
    ModelVersion.RISK_SCORING_V1: ModelConfig(...),
}
```

### Model Versions

| Model | Version | Description |
|-------|---------|-------------|
| Signal Quality | `signal-quality-v1.0.0` | Statistical signal quality assessment |
| Anomaly Detection | `anomaly-detection-v1.0.0` | Z-score based anomaly detection |
| Risk Scoring | `risk-scoring-v1.0.0` | Weighted risk scoring |

### Model Metadata

Each model includes:
- **Version**: Fixed version string
- **Created date**: When model was created
- **Deterministic**: Always `true` (no randomness)
- **Inference-only**: Always `true` (no training)
- **Parameters**: Model-specific parameters (weights, thresholds)

## Configurable Thresholds

### Alert Thresholds

All thresholds are configurable via environment variables:

#### Heart Rate Thresholds
```bash
ALERT_HR_NORMAL_MIN=60      # Normal range minimum (bpm)
ALERT_HR_NORMAL_MAX=100     # Normal range maximum (bpm)
ALERT_HR_WARNING_MIN=50     # Warning threshold minimum (bpm)
ALERT_HR_WARNING_MAX=120    # Warning threshold maximum (bpm)
ALERT_HR_CRITICAL_MIN=40    # Critical threshold minimum (bpm)
ALERT_HR_CRITICAL_MAX=150   # Critical threshold maximum (bpm)
```

#### Temperature Thresholds
```bash
ALERT_TEMP_NORMAL_MIN=36.1   # Normal range minimum (°C)
ALERT_TEMP_NORMAL_MAX=37.2    # Normal range maximum (°C)
ALERT_TEMP_WARNING_MIN=35.5   # Warning threshold minimum (°C)
ALERT_TEMP_WARNING_MAX=38.0   # Warning threshold maximum (°C)
ALERT_TEMP_CRITICAL_MIN=34.0  # Critical threshold minimum (°C)
ALERT_TEMP_CRITICAL_MAX=39.5  # Critical threshold maximum (°C)
```

#### Oxygen Saturation Thresholds
```bash
ALERT_SPO2_NORMAL_MIN=95      # Normal threshold (%)
ALERT_SPO2_WARNING_MIN=93     # Warning threshold (%)
ALERT_SPO2_CRITICAL_MIN=90    # Critical threshold (%)
```

#### Blood Pressure Thresholds
```bash
ALERT_BP_SYSTOLIC_NORMAL_MAX=140   # Normal maximum (mmHg)
ALERT_BP_SYSTOLIC_WARNING_MAX=160  # Warning maximum (mmHg)
ALERT_BP_SYSTOLIC_CRITICAL_MAX=180 # Critical maximum (mmHg)
ALERT_BP_SYSTOLIC_NORMAL_MIN=90    # Normal minimum (mmHg)
ALERT_BP_SYSTOLIC_WARNING_MIN=80   # Warning minimum (mmHg)
ALERT_BP_SYSTOLIC_CRITICAL_MIN=70  # Critical minimum (mmHg)
```

#### Battery & Signal Thresholds
```bash
ALERT_BATTERY_WARNING=20      # Warning threshold (%)
ALERT_BATTERY_CRITICAL=10     # Critical threshold (%)
ALERT_SIGNAL_WARNING=-90      # Warning threshold (dBm)
ALERT_SIGNAL_CRITICAL=-100    # Critical threshold (dBm)
```

#### Confidence Thresholds
```bash
ALERT_MIN_CONFIDENCE=0.6      # Minimum confidence to trigger alert (0-1)
```

### Model-Specific Thresholds

#### Anomaly Detection
- **Z-score threshold**: 3.0 standard deviations (configurable in model config)
- **Trend change threshold**: 20% change (configurable in model config)

#### Risk Scoring
- **Low risk**: < 0.25
- **Moderate risk**: 0.25 - 0.5
- **High risk**: 0.5 - 0.75
- **Critical risk**: >= 0.75

#### Signal Quality
- **Excellent**: >= 0.8
- **Good**: >= 0.6
- **Fair**: >= 0.4
- **Poor**: < 0.4
- **Usable threshold**: >= 0.5

## Confidence Scoring

### Alert Confidence

Every alert includes a confidence score (0-1) calculated based on:

1. **Deviation magnitude**: Larger deviations = higher confidence
2. **Threshold proximity**: Further from threshold = higher confidence
3. **Data quality**: Better signal quality = higher confidence

### Confidence Calculation

```typescript
// Example: Heart rate high alert
confidence = 0.7 + (deviation / normalRange) * 0.3
```

### Minimum Confidence Threshold

Alerts with confidence below `ALERT_MIN_CONFIDENCE` (default: 0.6) are **not triggered**.

This prevents false positives from noisy data.

## Explainable Outputs

### Alert Explanations

Every alert includes an `explanation` field that describes:

1. **What triggered the alert**: The metric and value
2. **Why it triggered**: Comparison to thresholds
3. **How much it exceeded**: Exact deviation from threshold

**Example:**
```
"Heart rate 150 bpm exceeds normal range (60-100 bpm). 
Threshold exceeded by 50.0 bpm."
```

### AI Analysis Explanations

AI analysis results include:

1. **Anomaly Detection**:
   - Description of each anomaly
   - Z-score and baseline comparison
   - Affected metrics

2. **Risk Scoring**:
   - Primary concerns (top 3)
   - Risk factors with scores and weights
   - Recommended actions

3. **Signal Quality**:
   - Quality grade and score
   - Specific recommendations
   - Metric breakdown (SNR, RMS error, etc.)

## Deterministic Behavior

### Fixed Random Seeds

All models use fixed random seeds:

```python
np.random.seed(42)  # Fixed seed for all models
```

This ensures:
- **Reproducibility**: Same input = same output
- **No randomness**: Deterministic calculations only
- **Consistency**: Results don't vary between runs

### No Training Code

The codebase contains **zero training code**. All models are:
- Pre-trained (or use statistical methods)
- Inference-only
- Fixed parameters

## Model Version Tracking

### Response Metadata

All AI service responses include `model_version`:

```json
{
  "device_id": "dev-001",
  "anomalies_detected": true,
  "model_version": "anomaly-detection-v1.0.0",
  ...
}
```

### Database Storage

Model versions are stored in:
- `ai_analyses` table: `evidence.modelVersion`
- `alerts` table: `alertData.modelVersion` (if from AI analysis)

## Alert Flow with Confidence

```
1. Metric ingested
   ↓
2. Alert rules engine evaluates
   ↓
3. Calculate confidence score
   ↓
4. Check confidence >= MIN_CONFIDENCE
   ↓
5. Generate explanation
   ↓
6. Create alert with:
   - Description
   - Explanation (why triggered)
   - Confidence score
   - Thresholds used
```

## Example Alert

```json
{
  "id": "alert-123",
  "alertType": "HEART_RATE_HIGH",
  "severity": "HIGH",
  "description": "Elevated heart rate detected: 130 bpm",
  "explanation": "Heart rate 130 bpm exceeds normal range (60-100 bpm). Threshold exceeded by 30.0 bpm.",
  "confidence": 0.85,
  "alertData": {
    "heartRate": 130,
    "thresholds": {
      "normal": "60-100 bpm",
      "warning": "50-120 bpm",
      "critical": "<40 or >150 bpm"
    },
    "explanation": "Heart rate 130 bpm exceeds normal range (60-100 bpm). Threshold exceeded by 30.0 bpm."
  }
}
```

## Testing Deterministic Behavior

### Test Same Input Twice

```python
# First call
response1 = service.detect_anomalies(request)

# Second call (should be identical)
response2 = service.detect_anomalies(request)

assert response1 == response2  # Should always pass
```

### Test Threshold Changes

```python
# Change threshold
os.environ['ALERT_HR_NORMAL_MAX'] = '110'

# Restart service (thresholds loaded at startup)
# Alerts should now trigger at different values
```

## Model Updates

### Versioning Strategy

When updating models:

1. **Create new version**: `anomaly-detection-v1.1.0`
2. **Add to registry**: Update `MODEL_REGISTRY`
3. **Update default**: Change `get_latest_model_version()` if needed
4. **Deploy**: Old version continues to work, new version available

### Backward Compatibility

- Old model versions remain in registry
- Existing analyses reference their model version
- New analyses use latest version (or specified version)

## Performance

### Singleton Pattern

All services use singleton pattern:
- Single instance per service
- Shared state (model config, thresholds)
- Efficient memory usage

### Deterministic = Fast

- No model loading overhead
- No training computation
- Pure inference = fast response times

## Monitoring

### Metrics to Track

1. **Model version distribution**: Which versions are used
2. **Confidence distribution**: Average confidence scores
3. **Threshold effectiveness**: Alert rates by threshold
4. **False positive rate**: Alerts with low confidence
5. **Explanation quality**: User feedback on explanations

## Troubleshooting

### Low Confidence Alerts

If alerts have low confidence:
- Check signal quality
- Verify thresholds are appropriate
- Review data quality

### Unexpected Alerts

If alerts trigger unexpectedly:
- Check threshold values
- Review explanation field
- Verify confidence score
- Check for data anomalies

### Model Version Issues

If wrong model version used:
- Check `MODEL_REGISTRY` configuration
- Verify `get_latest_model_version()` returns correct version
- Check service initialization

---

**Last Updated**: 2026-01-15
**Version**: 1.0.0
