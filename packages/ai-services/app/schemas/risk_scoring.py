"""Risk scoring schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    """Risk level categories."""

    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class RiskFactors(BaseModel):
    """Individual risk factors contributing to overall risk."""

    factor_name: str = Field(..., description="Name of the risk factor")
    factor_score: float = Field(
        ..., description="Risk score for this factor (0-1)", ge=0, le=1
    )
    weight: float = Field(
        ..., description="Weight of this factor in overall score (0-1)", ge=0, le=1
    )
    description: str = Field(..., description="Description of the risk factor")
    evidence: Optional[dict[str, Any]] = Field(
        None, description="Evidence supporting this risk factor"
    )


class RiskScoringRequest(BaseModel):
    """Request for risk scoring."""

    device_id: str = Field(..., description="Device identifier")
    inmate_device_id: Optional[str] = Field(
        None, description="Inmate-device assignment ID"
    )
    vital_metrics: dict[str, float] = Field(
        ..., description="Current vital metrics", min_length=1
    )
    historical_trends: Optional[dict[str, list[float]]] = Field(
        None, description="Historical trend data for each metric"
    )
    anomaly_flags: Optional[list[str]] = Field(
        None, description="List of detected anomaly types"
    )
    signal_quality_score: Optional[float] = Field(
        None, description="Signal quality score (0-1)", ge=0, le=1
    )
    time_window_hours: int = Field(
        ..., description="Time window for risk assessment (hours)", gt=0, le=168
    )
    metadata: Optional[dict[str, Any]] = Field(
        None, description="Additional metadata"
    )

    model_config = {"json_schema_extra": {"example": {
        "device_id": "dev-001",
        "inmate_device_id": "inmate-dev-001",
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
        "metadata": {"facility_id": "facility-001"}
    }}}


class RiskScoringResponse(BaseModel):
    """Response for risk scoring."""

    device_id: str = Field(..., description="Device identifier")
    overall_risk_score: float = Field(
        ..., description="Overall risk score (0-1)", ge=0, le=1
    )
    risk_level: RiskLevel = Field(..., description="Risk level category")
    risk_factors: list[RiskFactors] = Field(
        ..., description="Individual risk factors"
    )
    primary_concerns: list[str] = Field(
        ..., description="Primary concerns identified"
    )
    recommended_actions: list[str] = Field(
        ..., description="Recommended actions based on risk assessment"
    )
    confidence: float = Field(
        ..., description="Confidence in risk assessment (0-1)", ge=0, le=1
    )
    assessed_at: datetime = Field(..., description="Assessment timestamp")
    valid_until: datetime = Field(
        ..., description="Assessment validity expiration timestamp"
    )
    model_version: Optional[str] = Field(
        None, description="Model version used for inference"
    )

    model_config = {"json_schema_extra": {"example": {
        "device_id": "dev-001",
        "overall_risk_score": 0.65,
        "risk_level": "moderate",
        "risk_factors": [
            {
                "factor_name": "Elevated Heart Rate",
                "factor_score": 0.7,
                "weight": 0.4,
                "description": "Heart rate trending upward over 24 hours",
                "evidence": {"baseline": 72, "current": 95, "trend": "increasing"}
            },
            {
                "factor_name": "Temperature Elevation",
                "factor_score": 0.6,
                "weight": 0.3,
                "description": "Body temperature slightly elevated",
                "evidence": {"baseline": 36.5, "current": 37.2}
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
    }}}
