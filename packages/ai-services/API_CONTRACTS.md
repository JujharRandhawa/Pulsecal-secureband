# AI Services API Contracts

This document describes the API contracts for PulseCal SecureBand AI Services.

## Base URL

```
http://localhost:8000/api/v1
```

## Endpoints

### 1. Signal Quality Assessment

**Endpoint:** `POST /signal-quality`

**Description:** Assesses the quality of incoming signal data from devices.

**Request Schema:**
```json
{
  "device_id": "string",
  "signal_data": [0.5, 0.52, 0.48, ...],
  "sampling_rate": 100.0,
  "signal_type": "ppg|temperature|imu",
  "recorded_at": "2024-01-15T10:30:00Z",
  "metadata": {}
}
```

**Response Schema:**
```json
{
  "device_id": "string",
  "quality_score": 0.85,
  "quality_grade": "excellent|good|fair|poor",
  "metrics": {
    "snr": 25.5,
    "rms_error": 0.02,
    "peak_detection_confidence": 0.92,
    "baseline_drift": 0.01,
    "motion_artifact_score": 0.15
  },
  "is_usable": true,
  "recommendations": ["Signal quality is acceptable"],
  "processed_at": "2024-01-15T10:30:01Z"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/v1/signal-quality \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "dev-001",
    "signal_data": [0.5, 0.52, 0.48, 0.51, 0.49],
    "sampling_rate": 100.0,
    "signal_type": "ppg",
    "recorded_at": "2024-01-15T10:30:00Z"
  }'
```

---

### 2. Anomaly Detection

**Endpoint:** `POST /anomaly-detection`

**Description:** Detects anomalies in time-series device data.

**Request Schema:**
```json
{
  "device_id": "string",
  "inmate_device_id": "string (optional)",
  "time_series_data": {
    "heart_rate": [72, 73, 74, 150, 75],
    "temperature": [36.5, 36.6, 36.5, 36.4]
  },
  "timestamps": [
    "2024-01-15T10:30:00Z",
    "2024-01-15T10:30:01Z",
    ...
  ],
  "baseline_stats": {
    "heart_rate": {"mean": 72, "std": 5},
    "temperature": {"mean": 36.5, "std": 0.3}
  },
  "metadata": {}
}
```

**Response Schema:**
```json
{
  "device_id": "string",
  "anomalies_detected": true,
  "anomaly_count": 1,
  "anomalies": [
    {
      "anomaly_type": "heart_rate_abnormal|temperature_abnormal|motion_anomaly|signal_loss|device_tamper|pattern_deviation|unknown",
      "severity": 0.8,
      "confidence": 0.92,
      "description": "Heart rate spike detected: 150 bpm",
      "detected_at": "2024-01-15T10:30:03Z",
      "affected_metrics": ["heart_rate"],
      "context": {}
    }
  ],
  "overall_risk_score": 0.75,
  "processed_at": "2024-01-15T10:30:06Z"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/v1/anomaly-detection \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "dev-001",
    "time_series_data": {
      "heart_rate": [72, 73, 74, 150, 75, 76],
      "temperature": [36.5, 36.6, 36.5, 36.4, 36.5]
    },
    "timestamps": [
      "2024-01-15T10:30:00Z",
      "2024-01-15T10:30:01Z",
      "2024-01-15T10:30:02Z",
      "2024-01-15T10:30:03Z",
      "2024-01-15T10:30:04Z",
      "2024-01-15T10:30:05Z"
    ],
    "baseline_stats": {
      "heart_rate": {"mean": 72, "std": 5},
      "temperature": {"mean": 36.5, "std": 0.3}
    }
  }'
```

---

### 3. Risk Scoring

**Endpoint:** `POST /risk-scoring`

**Description:** Calculates comprehensive risk scores based on vital metrics, trends, and anomalies.

**Request Schema:**
```json
{
  "device_id": "string",
  "inmate_device_id": "string (optional)",
  "vital_metrics": {
    "heart_rate": 95,
    "temperature": 37.2,
    "oxygen_saturation": 96
  },
  "historical_trends": {
    "heart_rate": [72, 75, 80, 85, 90, 95],
    "temperature": [36.5, 36.6, 36.8, 37.0, 37.1, 37.2]
  },
  "anomaly_flags": ["heart_rate_abnormal", "temperature_abnormal"],
  "signal_quality_score": 0.85,
  "time_window_hours": 24,
  "metadata": {}
}
```

**Response Schema:**
```json
{
  "device_id": "string",
  "overall_risk_score": 0.65,
  "risk_level": "low|moderate|high|critical",
  "risk_factors": [
    {
      "factor_name": "Elevated Heart Rate",
      "factor_score": 0.7,
      "weight": 0.4,
      "description": "Heart rate trending upward over 24 hours",
      "evidence": {
        "baseline": 72,
        "current": 95,
        "trend": "increasing"
      }
    }
  ],
  "primary_concerns": [
    "Elevated heart rate trend",
    "Temperature elevation"
  ],
  "recommended_actions": [
    "Monitor closely for next 2 hours",
    "Consider medical evaluation if trend continues"
  ],
  "confidence": 0.82,
  "assessed_at": "2024-01-15T10:30:00Z",
  "valid_until": "2024-01-15T11:30:00Z"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/v1/risk-scoring \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "dev-001",
    "vital_metrics": {
      "heart_rate": 95,
      "temperature": 37.2,
      "oxygen_saturation": 96
    },
    "historical_trends": {
      "heart_rate": [72, 75, 80, 85, 90, 95],
      "temperature": [36.5, 36.6, 36.8, 37.0, 37.1, 37.2]
    },
    "anomaly_flags": ["heart_rate_abnormal", "temperature_abnormal"],
    "signal_quality_score": 0.85,
    "time_window_hours": 24
  }'
```

---

## Error Responses

All endpoints return standard HTTP status codes:

- `200 OK`: Successful request
- `400 Bad Request`: Invalid input data
- `500 Internal Server Error`: Server-side error

Error response format:
```json
{
  "detail": "Error message describing what went wrong"
}
```

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Signal data arrays should contain numeric values
- Quality scores and risk scores range from 0.0 to 1.0
- Placeholder inference logic is currently used; ML models will be integrated later
- All endpoints are synchronous and return results immediately
