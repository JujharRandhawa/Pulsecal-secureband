"""
Production-ready anomaly detection service with:
- Fixed, versioned model
- Configurable thresholds
- Explainable outputs
- Deterministic behavior
- Confidence scoring
"""

import numpy as np
from datetime import datetime
from typing import Optional

from app.schemas.anomaly_detection import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    AnomalyResult,
    AnomalyType,
)
from app.config.model_config import (
    ModelVersion,
    get_model_config,
    get_latest_model_version,
)


class AnomalyDetectionService:
    """Service for detecting anomalies using fixed, versioned models."""

    def __init__(self):
        """Initialize with fixed model version."""
        self.model_version = get_latest_model_version("anomaly_detection")
        self.config = get_model_config(self.model_version)
        self.thresholds = self.config.thresholds
        
        # Set random seed for deterministic behavior
        np.random.seed(self.config.random_seed)

    def detect_anomalies(
        self, request: AnomalyDetectionRequest
    ) -> AnomalyDetectionResponse:
        """
        Detect anomalies using fixed, versioned model.
        
        This is inference-only - no training occurs.
        """
        anomalies: list[AnomalyResult] = []

        # Detect anomalies for each metric
        for metric_name, values in request.time_series_data.items():
            metric_anomalies = self._detect_metric_anomalies(
                metric_name, values, request.timestamps, request.baseline_stats
            )
            anomalies.extend(metric_anomalies)

        # Detect cross-metric anomalies
        cross_metric_anomalies = self._detect_cross_metric_anomalies(
            request.time_series_data, request.timestamps
        )
        anomalies.extend(cross_metric_anomalies)

        # Calculate overall risk score
        overall_risk_score = self._calculate_overall_risk(anomalies)

        return AnomalyDetectionResponse(
            device_id=request.device_id,
            anomalies_detected=len(anomalies) > 0,
            anomaly_count=len(anomalies),
            anomalies=anomalies,
            overall_risk_score=overall_risk_score,
            processed_at=datetime.utcnow(),
            model_version=str(self.model_version.value),  # Include model version
        )

    def _detect_metric_anomalies(
        self,
        metric_name: str,
        values: list[float],
        timestamps: list[datetime],
        baseline_stats: Optional[dict[str, dict[str, float]]],
    ) -> list[AnomalyResult]:
        """Detect anomalies in a single metric using fixed thresholds."""
        anomalies: list[AnomalyResult] = []
        values_array = np.array(values)

        if len(values) < 3:
            return anomalies

        # Use baseline stats if available, otherwise calculate from data
        if baseline_stats and metric_name in baseline_stats:
            baseline_mean = baseline_stats[metric_name].get("mean", np.mean(values_array))
            baseline_std = baseline_stats[metric_name].get("std", np.std(values_array))
        else:
            baseline_mean = np.mean(values_array)
            baseline_std = np.std(values_array)

        # Use configurable Z-score threshold
        z_score_threshold = self.thresholds.Z_SCORE_THRESHOLD
        
        # Detect statistical outliers (deterministic calculation)
        z_scores = np.abs((values_array - baseline_mean) / baseline_std) if baseline_std > 0 else np.zeros_like(values_array)
        outlier_indices = np.where(z_scores > z_score_threshold)[0]

        for idx in outlier_indices:
            value = float(values_array[idx])
            z_score = float(z_scores[idx])
            
            # Calculate severity (0-1 scale)
            severity = min(1.0, z_score / (z_score_threshold * 2))
            
            # Calculate confidence based on deviation magnitude
            # Higher deviation = higher confidence
            confidence = min(1.0, 0.7 + (z_score - z_score_threshold) * 0.1)
            
            # Ensure confidence meets minimum threshold
            if confidence < self.thresholds.MIN_CONFIDENCE_FOR_ALERT:
                continue  # Skip low-confidence anomalies

            # Determine anomaly type based on metric
            anomaly_type = self._determine_anomaly_type(metric_name, value, baseline_mean)

            # Generate explainable description
            description = self._generate_explanation(
                metric_name, value, baseline_mean, baseline_std, z_score
            )

            anomalies.append(
                AnomalyResult(
                    anomaly_type=anomaly_type,
                    severity=severity,
                    confidence=confidence,
                    description=description,
                    detected_at=timestamps[idx],
                    affected_metrics=[metric_name],
                    context={
                        "baseline_mean": float(baseline_mean),
                        "baseline_std": float(baseline_std),
                        "detected_value": value,
                        "z_score": float(z_score),
                        "z_score_threshold": z_score_threshold,
                        "model_version": str(self.model_version.value),
                        "explanation": description,
                    },
                )
            )

        # Detect trend anomalies (sudden changes)
        if len(values) >= 5:
            trend_anomalies = self._detect_trend_anomalies(
                metric_name, values_array, timestamps, baseline_mean
            )
            anomalies.extend(trend_anomalies)

        return anomalies

    def _detect_trend_anomalies(
        self,
        metric_name: str,
        values: np.ndarray,
        timestamps: list[datetime],
        baseline_mean: float,
    ) -> list[AnomalyResult]:
        """Detect sudden trend changes using configurable threshold."""
        anomalies: list[AnomalyResult] = []

        if len(values) < 5:
            return anomalies

        # Use configurable trend change threshold
        trend_threshold = self.thresholds.TREND_CHANGE_THRESHOLD

        # Calculate rolling mean difference (deterministic)
        window_size = min(3, len(values) // 2)
        rolling_mean = np.convolve(values, np.ones(window_size) / window_size, mode="valid")

        # Detect sudden changes
        for i in range(1, len(rolling_mean)):
            change = abs(rolling_mean[i] - rolling_mean[i - 1])
            threshold = abs(baseline_mean) * trend_threshold

            if change > threshold:
                severity = min(1.0, change / (abs(baseline_mean) * 0.5))
                confidence = min(1.0, 0.75 + (change / threshold - 1) * 0.1)
                
                # Ensure minimum confidence
                if confidence < self.thresholds.MIN_CONFIDENCE_FOR_ALERT:
                    continue

                explanation = (
                    f"Sudden change in {metric_name}: {change:.2f} "
                    f"(threshold: {threshold:.2f}, baseline: {baseline_mean:.2f})"
                )

                anomalies.append(
                    AnomalyResult(
                        anomaly_type=AnomalyType.PATTERN_DEVIATION,
                        severity=severity,
                        confidence=confidence,
                        description=explanation,
                        detected_at=timestamps[i + window_size - 1],
                        affected_metrics=[metric_name],
                        context={
                            "change_magnitude": float(change),
                            "baseline_mean": float(baseline_mean),
                            "threshold": float(threshold),
                            "model_version": str(self.model_version.value),
                            "explanation": explanation,
                        },
                    )
                )

        return anomalies

    def _detect_cross_metric_anomalies(
        self,
        time_series_data: dict[str, list[float]],
        timestamps: list[datetime],
    ) -> list[AnomalyResult]:
        """Detect anomalies across multiple metrics."""
        anomalies: list[AnomalyResult] = []

        # Example: Detect if heart rate and temperature both spike simultaneously
        if "heart_rate" in time_series_data and "temperature" in time_series_data:
            hr_values = np.array(time_series_data["heart_rate"])
            temp_values = np.array(time_series_data["temperature"])

            if len(hr_values) == len(temp_values) and len(hr_values) > 0:
                hr_mean = np.mean(hr_values)
                temp_mean = np.mean(temp_values)

                # Detect simultaneous spikes (using configurable thresholds)
                hr_threshold = hr_mean * 1.2  # 20% above mean
                temp_threshold = temp_mean * 1.1  # 10% above mean

                for i in range(len(hr_values)):
                    hr_spike = hr_values[i] > hr_threshold
                    temp_spike = temp_values[i] > temp_threshold

                    if hr_spike and temp_spike:
                        confidence = 0.8  # High confidence for cross-metric patterns
                        
                        explanation = (
                            f"Simultaneous elevation detected: "
                            f"heart rate {hr_values[i]:.0f} bpm (normal: {hr_mean:.0f}±{np.std(hr_values):.0f}), "
                            f"temperature {temp_values[i]:.2f}°C (normal: {temp_mean:.2f}±{np.std(temp_values):.2f})"
                        )

                        anomalies.append(
                            AnomalyResult(
                                anomaly_type=AnomalyType.PATTERN_DEVIATION,
                                severity=0.7,
                                confidence=confidence,
                                description=explanation,
                                detected_at=timestamps[i],
                                affected_metrics=["heart_rate", "temperature"],
                                context={
                                    "heart_rate_value": float(hr_values[i]),
                                    "temperature_value": float(temp_values[i]),
                                    "heart_rate_threshold": float(hr_threshold),
                                    "temperature_threshold": float(temp_threshold),
                                    "model_version": str(self.model_version.value),
                                    "explanation": explanation,
                                },
                            )
                        )

        return anomalies

    def _determine_anomaly_type(
        self, metric_name: str, value: float, baseline_mean: float
    ) -> AnomalyType:
        """Determine anomaly type based on metric name and value."""
        metric_lower = metric_name.lower()

        if "heart" in metric_lower or "hr" in metric_lower:
            return AnomalyType.HEART_RATE_ABNORMAL
        elif "temp" in metric_lower:
            return AnomalyType.TEMPERATURE_ABNORMAL
        elif "motion" in metric_lower or "imu" in metric_lower:
            return AnomalyType.MOTION_ANOMALY
        else:
            return AnomalyType.UNKNOWN

    def _generate_explanation(
        self,
        metric_name: str,
        value: float,
        baseline_mean: float,
        baseline_std: float,
        z_score: float,
    ) -> str:
        """Generate explainable, human-readable description of anomaly."""
        deviation = value - baseline_mean
        deviation_pct = (deviation / baseline_mean * 100) if baseline_mean != 0 else 0

        # Determine severity description
        if abs(deviation_pct) > 50:
            severity_desc = "significant"
        elif abs(deviation_pct) > 25:
            severity_desc = "moderate"
        else:
            severity_desc = "slight"

        direction = "above" if deviation > 0 else "below"

        explanation = (
            f"{metric_name.replace('_', ' ').title()} anomaly detected: "
            f"value {value:.2f} is {severity_desc}ly {direction} baseline "
            f"(baseline: {baseline_mean:.2f}±{baseline_std:.2f}, "
            f"Z-score: {z_score:.2f}, threshold: {self.thresholds.Z_SCORE_THRESHOLD:.1f})"
        )

        return explanation

    def _calculate_overall_risk(self, anomalies: list[AnomalyResult]) -> float:
        """Calculate overall risk score from anomalies (weighted by confidence)."""
        if not anomalies:
            return 0.0

        # Weighted average of anomaly severities, weighted by confidence
        total_weighted_severity = sum(
            anomaly.severity * anomaly.confidence for anomaly in anomalies
        )
        total_weight = sum(anomaly.confidence for anomaly in anomalies)

        if total_weight > 0:
            return min(1.0, total_weighted_severity / total_weight)

        return 0.0


# Global service instance (singleton pattern for deterministic behavior)
_anomaly_service: Optional[AnomalyDetectionService] = None


def get_anomaly_detection_service() -> AnomalyDetectionService:
    """Get singleton instance of anomaly detection service."""
    global _anomaly_service
    if _anomaly_service is None:
        _anomaly_service = AnomalyDetectionService()
    return _anomaly_service
