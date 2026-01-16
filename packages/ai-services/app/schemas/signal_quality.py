"""Signal quality assessment schemas."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class SignalQualityMetrics(BaseModel):
    """Signal quality metrics."""

    snr: float = Field(..., description="Signal-to-noise ratio (dB)", ge=-50, le=100)
    rms_error: float = Field(..., description="Root mean square error", ge=0)
    peak_detection_confidence: float = Field(
        ..., description="Peak detection confidence (0-1)", ge=0, le=1
    )
    baseline_drift: float = Field(..., description="Baseline drift magnitude", ge=0)
    motion_artifact_score: float = Field(
        ..., description="Motion artifact score (0-1)", ge=0, le=1
    )


class SignalQualityRequest(BaseModel):
    """Request for signal quality assessment."""

    device_id: str = Field(..., description="Device identifier")
    signal_data: list[float] = Field(
        ..., description="Time-series signal data", min_length=10, max_length=10000
    )
    sampling_rate: float = Field(
        ..., description="Sampling rate in Hz", gt=0, le=1000
    )
    signal_type: str = Field(
        ..., description="Type of signal (ppg, temperature, imu)", pattern="^(ppg|temperature|imu)$"
    )
    recorded_at: datetime = Field(..., description="Timestamp when signal was recorded")
    metadata: Optional[dict[str, Any]] = Field(
        None, description="Additional metadata"
    )

    model_config = {"json_schema_extra": {"example": {
        "device_id": "dev-001",
        "signal_data": [0.5, 0.52, 0.48, 0.51, 0.49],
        "sampling_rate": 100.0,
        "signal_type": "ppg",
        "recorded_at": "2024-01-15T10:30:00Z",
        "metadata": {"battery_level": 85}
    }}}


class SignalQualityResponse(BaseModel):
    """Response for signal quality assessment."""

    device_id: str = Field(..., description="Device identifier")
    quality_score: float = Field(
        ..., description="Overall quality score (0-1)", ge=0, le=1
    )
    quality_grade: str = Field(
        ..., description="Quality grade (excellent, good, fair, poor)", pattern="^(excellent|good|fair|poor)$"
    )
    metrics: SignalQualityMetrics = Field(..., description="Detailed quality metrics")
    is_usable: bool = Field(..., description="Whether signal is usable for analysis")
    recommendations: list[str] = Field(
        ..., description="Recommendations for improving signal quality"
    )
    processed_at: datetime = Field(..., description="Processing timestamp")
    model_version: Optional[str] = Field(
        None, description="Model version used for inference"
    )

    model_config = {"json_schema_extra": {"example": {
        "device_id": "dev-001",
        "quality_score": 0.85,
        "quality_grade": "good",
        "metrics": {
            "snr": 25.5,
            "rms_error": 0.02,
            "peak_detection_confidence": 0.92,
            "baseline_drift": 0.01,
            "motion_artifact_score": 0.15
        },
        "is_usable": True,
        "recommendations": ["Signal quality is acceptable"],
        "processed_at": "2024-01-15T10:30:01Z"
    }}}
