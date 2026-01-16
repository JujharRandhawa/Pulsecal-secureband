"""
Model configuration and versioning system.

This module defines:
- Fixed, versioned model configurations
- Configurable thresholds for alerts
- Model metadata and version tracking
- Deterministic behavior settings
"""

from dataclasses import dataclass
from typing import Dict, Any
from enum import Enum


class ModelVersion(str, Enum):
    """Fixed model versions - no on-device training, inference only."""
    
    # Signal Quality Model
    SIGNAL_QUALITY_V1 = "signal-quality-v1.0.0"
    
    # Anomaly Detection Model
    ANOMALY_DETECTION_V1 = "anomaly-detection-v1.0.0"
    
    # Risk Scoring Model
    RISK_SCORING_V1 = "risk-scoring-v1.0.0"


@dataclass
class ModelMetadata:
    """Metadata for a model version."""
    version: ModelVersion
    name: str
    description: str
    created_at: str
    deterministic: bool = True
    inference_only: bool = True
    parameters: Dict[str, Any] = None


@dataclass
class AlertThresholds:
    """Configurable thresholds for alert generation."""
    
    # Heart Rate Thresholds (bpm)
    HEART_RATE_NORMAL_MIN: float = 60.0
    HEART_RATE_NORMAL_MAX: float = 100.0
    HEART_RATE_WARNING_MIN: float = 50.0
    HEART_RATE_WARNING_MAX: float = 120.0
    HEART_RATE_CRITICAL_MIN: float = 40.0
    HEART_RATE_CRITICAL_MAX: float = 150.0
    
    # Temperature Thresholds (°C)
    TEMPERATURE_NORMAL_MIN: float = 36.1
    TEMPERATURE_NORMAL_MAX: float = 37.2
    TEMPERATURE_WARNING_MIN: float = 35.5
    TEMPERATURE_WARNING_MAX: float = 38.0
    TEMPERATURE_CRITICAL_MIN: float = 34.0
    TEMPERATURE_CRITICAL_MAX: float = 39.5
    
    # Oxygen Saturation Thresholds (%)
    OXYGEN_SATURATION_NORMAL_MIN: float = 95.0
    OXYGEN_SATURATION_WARNING_MIN: float = 93.0
    OXYGEN_SATURATION_CRITICAL_MIN: float = 90.0
    
    # Blood Pressure Thresholds (mmHg)
    BLOOD_PRESSURE_SYSTOLIC_NORMAL_MAX: float = 140.0
    BLOOD_PRESSURE_SYSTOLIC_WARNING_MAX: float = 160.0
    BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MAX: float = 180.0
    BLOOD_PRESSURE_SYSTOLIC_NORMAL_MIN: float = 90.0
    BLOOD_PRESSURE_SYSTOLIC_WARNING_MIN: float = 80.0
    BLOOD_PRESSURE_SYSTOLIC_CRITICAL_MIN: float = 70.0
    
    # Battery Thresholds (%)
    BATTERY_WARNING: float = 20.0
    BATTERY_CRITICAL: float = 10.0
    
    # Signal Strength Thresholds (dBm)
    SIGNAL_STRENGTH_WARNING: float = -90.0
    SIGNAL_STRENGTH_CRITICAL: float = -100.0
    
    # Anomaly Detection Thresholds
    Z_SCORE_THRESHOLD: float = 3.0  # Standard deviations for outlier detection
    TREND_CHANGE_THRESHOLD: float = 0.2  # 20% change for trend anomaly
    
    # Risk Score Thresholds
    RISK_SCORE_LOW: float = 0.25
    RISK_SCORE_MODERATE: float = 0.5
    RISK_SCORE_HIGH: float = 0.75
    
    # Confidence Thresholds
    MIN_CONFIDENCE_FOR_ALERT: float = 0.6  # Minimum confidence to trigger alert
    HIGH_CONFIDENCE_THRESHOLD: float = 0.8  # High confidence threshold
    
    # Signal Quality Thresholds
    SIGNAL_QUALITY_GOOD: float = 0.6
    SIGNAL_QUALITY_EXCELLENT: float = 0.8
    SIGNAL_QUALITY_USABLE: float = 0.5


@dataclass
class ModelConfig:
    """Complete model configuration."""
    version: ModelVersion
    metadata: ModelMetadata
    thresholds: AlertThresholds
    random_seed: int = 42  # Fixed seed for deterministic behavior


# Model Registry - Fixed, versioned models
MODEL_REGISTRY: Dict[ModelVersion, ModelConfig] = {
    ModelVersion.SIGNAL_QUALITY_V1: ModelConfig(
        version=ModelVersion.SIGNAL_QUALITY_V1,
        metadata=ModelMetadata(
            version=ModelVersion.SIGNAL_QUALITY_V1,
            name="Signal Quality Assessment Model",
            description="Statistical signal quality assessment using SNR, RMS error, and motion artifact detection",
            created_at="2026-01-15",
            deterministic=True,
            inference_only=True,
            parameters={
                "snr_weight": 0.3,
                "rms_weight": 0.2,
                "peak_confidence_weight": 0.2,
                "baseline_drift_weight": 0.15,
                "motion_artifact_weight": 0.15,
            },
        ),
        thresholds=AlertThresholds(),
        random_seed=42,
    ),
    
    ModelVersion.ANOMALY_DETECTION_V1: ModelConfig(
        version=ModelVersion.ANOMALY_DETECTION_V1,
        metadata=ModelMetadata(
            version=ModelVersion.ANOMALY_DETECTION_V1,
            name="Anomaly Detection Model",
            description="Z-score based anomaly detection with trend analysis",
            created_at="2026-01-15",
            deterministic=True,
            inference_only=True,
            parameters={
                "z_score_threshold": 3.0,
                "trend_window_size": 3,
                "trend_change_threshold": 0.2,
            },
        ),
        thresholds=AlertThresholds(),
        random_seed=42,
    ),
    
    ModelVersion.RISK_SCORING_V1: ModelConfig(
        version=ModelVersion.RISK_SCORING_V1,
        metadata=ModelMetadata(
            version=ModelVersion.RISK_SCORING_V1,
            name="Risk Scoring Model",
            description="Weighted risk scoring based on vital metrics, anomalies, and trends",
            created_at="2026-01-15",
            deterministic=True,
            inference_only=True,
            parameters={
                "heart_rate_weight": 0.4,
                "temperature_weight": 0.3,
                "oxygen_saturation_weight": 0.3,
                "anomaly_weight": 0.3,
                "signal_quality_weight": 0.1,
            },
        ),
        thresholds=AlertThresholds(),
        random_seed=42,
    ),
}


def get_model_config(version: ModelVersion) -> ModelConfig:
    """Get model configuration for a specific version."""
    if version not in MODEL_REGISTRY:
        raise ValueError(f"Model version {version} not found in registry")
    return MODEL_REGISTRY[version]


def get_latest_model_version(model_type: str) -> ModelVersion:
    """Get the latest version for a model type."""
    if model_type == "signal_quality":
        return ModelVersion.SIGNAL_QUALITY_V1
    elif model_type == "anomaly_detection":
        return ModelVersion.ANOMALY_DETECTION_V1
    elif model_type == "risk_scoring":
        return ModelVersion.RISK_SCORING_V1
    else:
        raise ValueError(f"Unknown model type: {model_type}")


def get_thresholds(version: ModelVersion) -> AlertThresholds:
    """Get thresholds for a model version."""
    config = get_model_config(version)
    return config.thresholds
