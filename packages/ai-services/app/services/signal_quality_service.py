"""
Production-ready signal quality service with:
- Fixed, versioned model
- Configurable thresholds
- Explainable outputs
- Deterministic behavior
"""

import numpy as np
from datetime import datetime
from typing import Optional

from app.schemas.signal_quality import (
    SignalQualityRequest,
    SignalQualityResponse,
    SignalQualityMetrics,
)
from app.config.model_config import (
    ModelVersion,
    get_model_config,
    get_latest_model_version,
)


class SignalQualityService:
    """Service for assessing signal quality using fixed, versioned models."""

    def __init__(self):
        """Initialize with fixed model version."""
        self.model_version = get_latest_model_version("signal_quality")
        self.config = get_model_config(self.model_version)
        self.thresholds = self.config.thresholds
        self.params = self.config.metadata.parameters
        
        # Set random seed for deterministic behavior
        np.random.seed(self.config.random_seed)

    def assess_quality(
        self, request: SignalQualityRequest
    ) -> SignalQualityResponse:
        """
        Assess signal quality using fixed, versioned model.
        
        This is inference-only - no training occurs.
        """
        signal_array = np.array(request.signal_data)

        # Calculate quality metrics (deterministic)
        snr = self._calculate_snr(signal_array)
        rms_error = self._calculate_rms_error(signal_array)
        peak_confidence = self._calculate_peak_confidence(signal_array)
        baseline_drift = self._calculate_baseline_drift(signal_array)
        motion_artifact = self._calculate_motion_artifact(
            signal_array, request.signal_type
        )

        # Calculate overall quality score using configurable weights
        quality_score = self._calculate_quality_score(
            snr, rms_error, peak_confidence, baseline_drift, motion_artifact
        )

        # Determine quality grade using configurable thresholds
        quality_grade = self._determine_quality_grade(quality_score)

        # Determine if usable using configurable threshold
        is_usable = quality_score >= self.thresholds.SIGNAL_QUALITY_USABLE

        # Generate explainable recommendations
        recommendations = self._generate_recommendations(
            snr, rms_error, peak_confidence, baseline_drift, motion_artifact, quality_score
        )

        metrics = SignalQualityMetrics(
            snr=snr,
            rms_error=rms_error,
            peak_detection_confidence=peak_confidence,
            baseline_drift=baseline_drift,
            motion_artifact_score=motion_artifact,
        )

        return SignalQualityResponse(
            device_id=request.device_id,
            quality_score=quality_score,
            quality_grade=quality_grade,
            metrics=metrics,
            is_usable=is_usable,
            recommendations=recommendations,
            processed_at=datetime.utcnow(),
            model_version=str(self.model_version.value),
        )

    def _calculate_snr(self, signal: np.ndarray) -> float:
        """Calculate signal-to-noise ratio (deterministic)."""
        signal_power = np.mean(signal ** 2)
        noise_estimate = np.std(np.diff(signal)) ** 2
        if noise_estimate > 0:
            snr_db = 10 * np.log10(signal_power / noise_estimate)
            return max(-50, min(100, snr_db))
        return 20.0  # Default if calculation fails

    def _calculate_rms_error(self, signal: np.ndarray) -> float:
        """Calculate RMS error (deterministic)."""
        return float(np.std(signal) / np.mean(np.abs(signal))) if np.mean(np.abs(signal)) > 0 else 0.1

    def _calculate_peak_confidence(self, signal: np.ndarray) -> float:
        """Calculate peak detection confidence (deterministic)."""
        if len(signal) < 3:
            return 0.5

        # Simple peak detection
        peaks = 0
        for i in range(1, len(signal) - 1):
            if signal[i] > signal[i - 1] and signal[i] > signal[i + 1]:
                peaks += 1

        # Normalize to 0-1
        expected_peaks = len(signal) / 10  # Rough estimate
        confidence = min(1.0, peaks / expected_peaks) if expected_peaks > 0 else 0.5
        return float(confidence)

    def _calculate_baseline_drift(self, signal: np.ndarray) -> float:
        """Calculate baseline drift (deterministic)."""
        if len(signal) < 2:
            return 0.0

        x = np.arange(len(signal))
        coeffs = np.polyfit(x, signal, 1)
        drift = abs(coeffs[0]) * len(signal)
        return float(drift)

    def _calculate_motion_artifact(
        self, signal: np.ndarray, signal_type: str
    ) -> float:
        """Calculate motion artifact score (deterministic)."""
        if len(signal) < 3:
            return 0.5

        # High-frequency component
        diff_signal = np.diff(signal)
        high_freq_energy = np.std(diff_signal)

        # Normalize based on signal type
        if signal_type == "ppg":
            threshold = np.std(signal) * 0.1
        elif signal_type == "temperature":
            threshold = np.std(signal) * 0.05
        else:  # imu
            threshold = np.std(signal) * 0.2

        artifact_score = min(1.0, high_freq_energy / threshold) if threshold > 0 else 0.5
        return float(artifact_score)

    def _calculate_quality_score(
        self,
        snr: float,
        rms_error: float,
        peak_confidence: float,
        baseline_drift: float,
        motion_artifact: float,
    ) -> float:
        """Calculate overall quality score using configurable weights."""
        # Normalize SNR (0-1 scale, assuming good SNR is >20dB)
        snr_normalized = min(1.0, max(0.0, (snr + 10) / 30))

        # Normalize RMS error (lower is better, assume <0.1 is good)
        rms_normalized = max(0.0, min(1.0, 1.0 - (rms_error / 0.1)))

        # Baseline drift (lower is better, assume <0.1 is good)
        drift_normalized = max(0.0, min(1.0, 1.0 - (baseline_drift / 0.1)))

        # Motion artifact (lower is better)
        motion_normalized = 1.0 - motion_artifact

        # Weighted average using configurable weights
        quality_score = (
            self.params["snr_weight"] * snr_normalized
            + self.params["rms_weight"] * rms_normalized
            + self.params["peak_confidence_weight"] * peak_confidence
            + self.params["baseline_drift_weight"] * drift_normalized
            + self.params["motion_artifact_weight"] * motion_normalized
        )

        return float(max(0.0, min(1.0, quality_score)))

    def _determine_quality_grade(self, quality_score: float) -> str:
        """Determine quality grade using configurable thresholds."""
        if quality_score >= self.thresholds.SIGNAL_QUALITY_EXCELLENT:
            return "excellent"
        elif quality_score >= self.thresholds.SIGNAL_QUALITY_GOOD:
            return "good"
        elif quality_score >= self.thresholds.SIGNAL_QUALITY_USABLE:
            return "fair"
        else:
            return "poor"

    def _generate_recommendations(
        self,
        snr: float,
        rms_error: float,
        peak_confidence: float,
        baseline_drift: float,
        motion_artifact: float,
        quality_score: float,
    ) -> list[str]:
        """Generate explainable recommendations based on quality metrics."""
        recommendations = []

        # SNR recommendations
        if snr < 15:
            recommendations.append(
                f"Low signal-to-noise ratio detected ({snr:.1f} dB, threshold: 15 dB). "
                "Check device positioning and connection quality."
            )

        # RMS error recommendations
        if rms_error > 0.1:
            recommendations.append(
                f"High RMS error detected ({rms_error:.3f}, threshold: 0.1). "
                "Verify sensor contact and calibration."
            )

        # Peak confidence recommendations
        if peak_confidence < 0.7:
            recommendations.append(
                f"Low peak detection confidence ({peak_confidence:.2f}, threshold: 0.7). "
                "Ensure stable device placement."
            )

        # Baseline drift recommendations
        if baseline_drift > 0.1:
            recommendations.append(
                f"Significant baseline drift detected ({baseline_drift:.3f}, threshold: 0.1). "
                "Check for environmental interference."
            )

        # Motion artifact recommendations
        if motion_artifact > 0.3:
            recommendations.append(
                f"Motion artifacts detected (score: {motion_artifact:.2f}, threshold: 0.3). "
                "Ensure device is securely fastened."
            )

        # Overall quality recommendations
        if quality_score < self.thresholds.SIGNAL_QUALITY_USABLE:
            recommendations.append(
                f"Overall signal quality is below acceptable threshold "
                f"({quality_score:.2f}, required: {self.thresholds.SIGNAL_QUALITY_USABLE:.2f}). "
                "Review device status and connection."
            )

        if not recommendations:
            recommendations.append(
                f"Signal quality is acceptable for analysis "
                f"(score: {quality_score:.2f}, grade: {self._determine_quality_grade(quality_score)})"
            )

        return recommendations


# Global service instance (singleton pattern for deterministic behavior)
_signal_quality_service: Optional[SignalQualityService] = None


def get_signal_quality_service() -> SignalQualityService:
    """Get singleton instance of signal quality service."""
    global _signal_quality_service
    if _signal_quality_service is None:
        _signal_quality_service = SignalQualityService()
    return _signal_quality_service
