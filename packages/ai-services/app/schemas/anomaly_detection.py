"""Anomaly detection schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class AnomalyType(str, Enum):
    """Types of anomalies."""

    HEART_RATE_ABNORMAL = "heart_rate_abnormal"
    TEMPERATURE_ABNORMAL = "temperature_abnormal"
    MOTION_ANOMALY = "motion_anomaly"
    SIGNAL_LOSS = "signal_loss"
    DEVICE_TAMPER = "device_tamper"
    PATTERN_DEVIATION = "pattern_deviation"
    UNKNOWN = "unknown"


class AnomalyResult(BaseModel):
    """Anomaly detection result."""

    anomaly_type: AnomalyType = Field(..., description="Type of anomaly detected")
    severity: float = Field(
        ..., description="Anomaly severity (0-1)", ge=0, le=1
    )
    confidence: float = Field(
        ..., description="Detection confidence (0-1)", ge=0, le=1
    )
    description: str = Field(..., description="Human-readable description")
    detected_at: datetime = Field(..., description="When anomaly was detected")
    affected_metrics: list[str] = Field(
        ..., description="List of affected metrics"
    )
    context: Optional[dict[str, Any]] = Field(
        None, description="Additional context about the anomaly"
    )


class AnomalyDetectionRequest(BaseModel):
    """Request for anomaly detection."""

    device_id: str = Field(..., description="Device identifier")
    inmate_device_id: Optional[str] = Field(
        None, description="Inmate-device assignment ID"
    )
    time_series_data: dict[str, list[float]] = Field(
        ..., description="Time-series data by metric name", min_length=1
    )
    timestamps: list[datetime] = Field(
        ..., description="Timestamps for each data point", min_length=1
    )
    baseline_stats: Optional[dict[str, dict[str, float]]] = Field(
        None, description="Baseline statistics for each metric"
    )
    metadata: Optional[dict[str, Any]] = Field(
        None, description="Additional metadata"
    )

    model_config = {"json_schema_extra": {"example": {
        "device_id": "dev-001",
        "inmate_device_id": "inmate-dev-001",
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
    }}}


class AnomalyDetectionResponse(BaseModel):
    """Response for anomaly detection."""

    device_id: str = Field(..., description="Device identifier")
    anomalies_detected: bool = Field(..., description="Whether any anomalies were found")
    anomaly_count: int = Field(..., description="Number of anomalies detected", ge=0)
    anomalies: list[AnomalyResult] = Field(
        ..., description="List of detected anomalies"
    )
    overall_risk_score: float = Field(
        ..., description="Overall risk score (0-1)", ge=0, le=1
    )
    processed_at: datetime = Field(..., description="Processing timestamp")
    model_version: Optional[str] = Field(
        None, description="Model version used for inference"
    )

    model_config = {"json_schema_extra": {"example": {
        "device_id": "dev-001",
        "anomalies_detected": True,
        "anomaly_count": 1,
        "anomalies": [
            {
                "anomaly_type": "heart_rate_abnormal",
                "severity": 0.8,
                "confidence": 0.92,
                "description": "Heart rate spike detected: 150 bpm (baseline: 72±5)",
                "detected_at": "2024-01-15T10:30:03Z",
                "affected_metrics": ["heart_rate"],
                "context": {"baseline_mean": 72, "detected_value": 150}
            }
        ],
        "overall_risk_score": 0.75,
        "processed_at": "2024-01-15T10:30:06Z"
    }}}
