"""
Production-ready risk scoring service with:
- Fixed, versioned model
- Configurable thresholds
- Explainable outputs
- Deterministic behavior
- Confidence scoring
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Optional

from app.schemas.risk_scoring import (
    RiskScoringRequest,
    RiskScoringResponse,
    RiskLevel,
    RiskFactors,
)
from app.config.model_config import (
    ModelVersion,
    get_model_config,
    get_latest_model_version,
)


class RiskScoringService:
    """Service for calculating risk scores using fixed, versioned models."""

    def __init__(self):
        """Initialize with fixed model version."""
        self.model_version = get_latest_model_version("risk_scoring")
        self.config = get_model_config(self.model_version)
        self.thresholds = self.config.thresholds
        self.params = self.config.metadata.parameters
        
        # Set random seed for deterministic behavior
        np.random.seed(self.config.random_seed)

    def calculate_risk(
        self, request: RiskScoringRequest
    ) -> RiskScoringResponse:
        """
        Calculate risk score using fixed, versioned model.
        
        This is inference-only - no training occurs.
        """
        risk_factors: list[RiskFactors] = []

        # Analyze vital metrics
        vital_risk_factors = self._analyze_vital_metrics(
            request.vital_metrics, request.historical_trends
        )
        risk_factors.extend(vital_risk_factors)

        # Analyze anomaly flags
        if request.anomaly_flags:
            anomaly_risk_factors = self._analyze_anomaly_flags(
                request.anomaly_flags
            )
            risk_factors.extend(anomaly_risk_factors)

        # Analyze signal quality
        if request.signal_quality_score is not None:
            signal_quality_factor = self._analyze_signal_quality(
                request.signal_quality_score
            )
            risk_factors.append(signal_quality_factor)

        # Analyze trends
        if request.historical_trends:
            trend_risk_factors = self._analyze_trends(
                request.historical_trends
            )
            risk_factors.extend(trend_risk_factors)

        # Calculate overall risk score
        overall_risk_score = self._calculate_overall_risk_score(risk_factors)

        # Determine risk level using configurable thresholds
        risk_level = self._determine_risk_level(overall_risk_score)

        # Generate primary concerns (explainable)
        primary_concerns = self._generate_primary_concerns(risk_factors)

        # Generate recommended actions (explainable)
        recommended_actions = self._generate_recommended_actions(
            overall_risk_score, risk_level, risk_factors
        )

        # Calculate confidence
        confidence = self._calculate_confidence(risk_factors, request)

        # Calculate validity period
        valid_until = datetime.utcnow() + timedelta(
            hours=min(request.time_window_hours, 1)
        )

        return RiskScoringResponse(
            device_id=request.device_id,
            overall_risk_score=overall_risk_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
            primary_concerns=primary_concerns,
            recommended_actions=recommended_actions,
            confidence=confidence,
            assessed_at=datetime.utcnow(),
            valid_until=valid_until,
            model_version=str(self.model_version.value),
        )

    def _analyze_vital_metrics(
        self,
        vital_metrics: dict[str, float],
        historical_trends: Optional[dict[str, list[float]]],
    ) -> list[RiskFactors]:
        """Analyze vital metrics for risk factors using configurable thresholds."""
        risk_factors: list[RiskFactors] = []

        # Heart rate analysis
        if "heart_rate" in vital_metrics:
            hr_value = vital_metrics["heart_rate"]
            hr_trend = (
                historical_trends.get("heart_rate", []) if historical_trends else None
            )

            hr_score = self._score_heart_rate(hr_value, hr_trend)
            hr_weight = self.params["heart_rate_weight"]

            explanation = self._explain_heart_rate_risk(hr_value, hr_trend, hr_score)

            risk_factors.append(
                RiskFactors(
                    factor_name="Heart Rate Assessment",
                    factor_score=hr_score,
                    weight=hr_weight,
                    description=explanation,
                    evidence={
                        "current_value": hr_value,
                        "trend": hr_trend,
                        "normal_range": f"{self.thresholds.HEART_RATE_NORMAL_MIN}-{self.thresholds.HEART_RATE_NORMAL_MAX} bpm",
                        "thresholds": {
                            "warning": f"{self.thresholds.HEART_RATE_WARNING_MIN}-{self.thresholds.HEART_RATE_WARNING_MAX}",
                            "critical": f"<{self.thresholds.HEART_RATE_CRITICAL_MIN} or >{self.thresholds.HEART_RATE_CRITICAL_MAX}",
                        },
                    },
                )
            )

        # Temperature analysis
        if "temperature" in vital_metrics or "temperature_celsius" in vital_metrics:
            temp_key = "temperature" if "temperature" in vital_metrics else "temperature_celsius"
            temp_value = vital_metrics[temp_key]
            temp_trend = (
                historical_trends.get(temp_key, []) if historical_trends else None
            )

            temp_score = self._score_temperature(temp_value, temp_trend)
            temp_weight = self.params["temperature_weight"]

            explanation = self._explain_temperature_risk(temp_value, temp_trend, temp_score)

            risk_factors.append(
                RiskFactors(
                    factor_name="Temperature Assessment",
                    factor_score=temp_score,
                    weight=temp_weight,
                    description=explanation,
                    evidence={
                        "current_value": temp_value,
                        "trend": temp_trend,
                        "normal_range": f"{self.thresholds.TEMPERATURE_NORMAL_MIN}-{self.thresholds.TEMPERATURE_NORMAL_MAX}°C",
                        "thresholds": {
                            "warning": f"{self.thresholds.TEMPERATURE_WARNING_MIN}-{self.thresholds.TEMPERATURE_WARNING_MAX}",
                            "critical": f"<{self.thresholds.TEMPERATURE_CRITICAL_MIN} or >{self.thresholds.TEMPERATURE_CRITICAL_MAX}",
                        },
                    },
                )
            )

        # Oxygen saturation analysis
        if "oxygen_saturation" in vital_metrics or "spo2" in vital_metrics:
            o2_key = "oxygen_saturation" if "oxygen_saturation" in vital_metrics else "spo2"
            o2_value = vital_metrics[o2_key]
            o2_score = self._score_oxygen_saturation(o2_value)
            o2_weight = self.params["oxygen_saturation_weight"]

            explanation = self._explain_oxygen_saturation_risk(o2_value, o2_score)

            risk_factors.append(
                RiskFactors(
                    factor_name="Oxygen Saturation Assessment",
                    factor_score=o2_score,
                    weight=o2_weight,
                    description=explanation,
                    evidence={
                        "current_value": o2_value,
                        "normal_min": self.thresholds.OXYGEN_SATURATION_NORMAL_MIN,
                        "thresholds": {
                            "warning": f"<{self.thresholds.OXYGEN_SATURATION_WARNING_MIN}%",
                            "critical": f"<{self.thresholds.OXYGEN_SATURATION_CRITICAL_MIN}%",
                        },
                    },
                )
            )

        return risk_factors

    def _score_heart_rate(
        self, value: float, trend: Optional[list[float]]
    ) -> float:
        """Score heart rate risk using configurable thresholds."""
        # Use configurable thresholds
        normal_min = self.thresholds.HEART_RATE_NORMAL_MIN
        normal_max = self.thresholds.HEART_RATE_NORMAL_MAX
        warning_min = self.thresholds.HEART_RATE_WARNING_MIN
        warning_max = self.thresholds.HEART_RATE_WARNING_MAX
        critical_min = self.thresholds.HEART_RATE_CRITICAL_MIN
        critical_max = self.thresholds.HEART_RATE_CRITICAL_MAX

        if value < critical_min or value > critical_max:
            base_score = 0.8  # Critical range
        elif value < warning_min or value > warning_max:
            base_score = 0.5  # Warning range
        elif value < normal_min or value > normal_max:
            base_score = 0.3  # Slightly outside normal
        else:
            base_score = 0.1  # Normal range

        # Adjust based on trend
        if trend and len(trend) >= 3:
            trend_array = np.array(trend)
            if len(trend_array) > 0:
                trend_direction = np.mean(np.diff(trend_array))
                if trend_direction > 5:  # Increasing trend
                    base_score = min(1.0, base_score + 0.2)
                elif trend_direction < -5:  # Decreasing trend
                    base_score = min(1.0, base_score + 0.15)

        return float(max(0.0, min(1.0, base_score)))

    def _score_temperature(
        self, value: float, trend: Optional[list[float]]
    ) -> float:
        """Score temperature risk using configurable thresholds."""
        normal_min = self.thresholds.TEMPERATURE_NORMAL_MIN
        normal_max = self.thresholds.TEMPERATURE_NORMAL_MAX
        warning_min = self.thresholds.TEMPERATURE_WARNING_MIN
        warning_max = self.thresholds.TEMPERATURE_WARNING_MAX
        critical_min = self.thresholds.TEMPERATURE_CRITICAL_MIN
        critical_max = self.thresholds.TEMPERATURE_CRITICAL_MAX

        if value < critical_min or value > critical_max:
            base_score = 0.8
        elif value < warning_min or value > warning_max:
            base_score = 0.5
        elif value < normal_min or value > normal_max:
            base_score = 0.3
        else:
            base_score = 0.1

        # Adjust based on trend
        if trend and len(trend) >= 3:
            trend_array = np.array(trend)
            if len(trend_array) > 0:
                trend_direction = np.mean(np.diff(trend_array))
                if trend_direction > 0.2:  # Increasing trend
                    base_score = min(1.0, base_score + 0.2)

        return float(max(0.0, min(1.0, base_score)))

    def _score_oxygen_saturation(self, value: float) -> float:
        """Score oxygen saturation risk using configurable thresholds."""
        normal_min = self.thresholds.OXYGEN_SATURATION_NORMAL_MIN
        warning_min = self.thresholds.OXYGEN_SATURATION_WARNING_MIN
        critical_min = self.thresholds.OXYGEN_SATURATION_CRITICAL_MIN

        if value < critical_min:
            return 1.0  # Critical
        elif value < warning_min:
            return 0.7  # Moderate risk
        elif value < normal_min:
            return 0.4  # Slight risk
        else:
            return 0.1  # Normal

    def _explain_heart_rate_risk(
        self, value: float, trend: Optional[list[float]], score: float
    ) -> str:
        """Generate explainable description for heart rate risk."""
        normal_min = self.thresholds.HEART_RATE_NORMAL_MIN
        normal_max = self.thresholds.HEART_RATE_NORMAL_MAX
        
        if value < normal_min:
            explanation = f"Bradycardia: {value:.0f} bpm (below normal range {normal_min}-{normal_max} bpm)"
        elif value > normal_max:
            explanation = f"Tachycardia: {value:.0f} bpm (above normal range {normal_min}-{normal_max} bpm)"
        elif trend and len(trend) >= 3:
            trend_direction = np.mean(np.diff(np.array(trend)))
            if trend_direction > 5:
                explanation = f"Heart rate trending upward: {value:.0f} bpm (trend: +{trend_direction:.1f} bpm/min)"
            elif trend_direction < -5:
                explanation = f"Heart rate trending downward: {value:.0f} bpm (trend: {trend_direction:.1f} bpm/min)"
            else:
                explanation = f"Heart rate within normal range: {value:.0f} bpm"
        else:
            explanation = f"Heart rate within normal range: {value:.0f} bpm"
        
        return f"{explanation} (risk score: {score:.2f})"

    def _explain_temperature_risk(
        self, value: float, trend: Optional[list[float]], score: float
    ) -> str:
        """Generate explainable description for temperature risk."""
        normal_min = self.thresholds.TEMPERATURE_NORMAL_MIN
        normal_max = self.thresholds.TEMPERATURE_NORMAL_MAX
        
        if value < normal_min:
            explanation = f"Low body temperature: {value:.2f}°C (normal: {normal_min}-{normal_max}°C, possible hypothermia)"
        elif value > normal_max:
            explanation = f"Elevated body temperature: {value:.2f}°C (normal: {normal_min}-{normal_max}°C, possible fever)"
        elif trend and len(trend) >= 3:
            trend_direction = np.mean(np.diff(np.array(trend)))
            if trend_direction > 0.2:
                explanation = f"Temperature trending upward: {value:.2f}°C (trend: +{trend_direction:.2f}°C/min)"
            else:
                explanation = f"Body temperature within normal range: {value:.2f}°C"
        else:
            explanation = f"Body temperature within normal range: {value:.2f}°C"
        
        return f"{explanation} (risk score: {score:.2f})"

    def _explain_oxygen_saturation_risk(self, value: float, score: float) -> str:
        """Generate explainable description for oxygen saturation risk."""
        normal_min = self.thresholds.OXYGEN_SATURATION_NORMAL_MIN
        warning_min = self.thresholds.OXYGEN_SATURATION_WARNING_MIN
        critical_min = self.thresholds.OXYGEN_SATURATION_CRITICAL_MIN
        
        if value < critical_min:
            explanation = f"Critical oxygen saturation: {value}% (normal: >{normal_min}%, critical threshold: <{critical_min}%)"
        elif value < warning_min:
            explanation = f"Low oxygen saturation: {value}% (normal: >{normal_min}%, warning threshold: <{warning_min}%)"
        elif value < normal_min:
            explanation = f"Slightly low oxygen saturation: {value}% (normal: >{normal_min}%)"
        else:
            explanation = f"Oxygen saturation normal: {value}%"
        
        return f"{explanation} (risk score: {score:.2f})"

    def _analyze_anomaly_flags(self, anomaly_flags: list[str]) -> list[RiskFactors]:
        """Analyze anomaly flags for risk factors."""
        risk_factors: list[RiskFactors] = []

        critical_anomalies = [
            "heart_rate_abnormal",
            "temperature_abnormal",
            "device_tamper",
        ]

        for flag in anomaly_flags:
            is_critical = flag in critical_anomalies
            score = 0.8 if is_critical else 0.5
            weight = self.params.get("anomaly_weight", 0.3) if is_critical else 0.2

            explanation = (
                f"Anomaly detected: {flag.replace('_', ' ').title()} "
                f"({'critical' if is_critical else 'moderate'} severity)"
            )

            risk_factors.append(
                RiskFactors(
                    factor_name=f"Anomaly: {flag.replace('_', ' ').title()}",
                    factor_score=score,
                    weight=weight,
                    description=explanation,
                    evidence={"anomaly_type": flag, "severity": "critical" if is_critical else "moderate"},
                )
            )

        return risk_factors

    def _analyze_signal_quality(self, quality_score: float) -> RiskFactors:
        """Analyze signal quality for risk factors."""
        # Lower quality = higher risk (inverse relationship)
        risk_score = 1.0 - quality_score
        weight = self.params.get("signal_quality_weight", 0.1)

        explanation = (
            f"Signal quality: {quality_score:.2f} "
            f"({'excellent' if quality_score >= self.thresholds.SIGNAL_QUALITY_EXCELLENT else 'good' if quality_score >= self.thresholds.SIGNAL_QUALITY_GOOD else 'fair' if quality_score >= self.thresholds.SIGNAL_QUALITY_USABLE else 'poor'})"
        )

        return RiskFactors(
            factor_name="Signal Quality",
            factor_score=risk_score,
            weight=weight,
            description=explanation,
            evidence={
                "quality_score": quality_score,
                "usable_threshold": self.thresholds.SIGNAL_QUALITY_USABLE,
            },
        )

    def _analyze_trends(
        self, historical_trends: dict[str, list[float]]
    ) -> list[RiskFactors]:
        """Analyze historical trends for risk factors."""
        risk_factors: list[RiskFactors] = []

        for metric_name, values in historical_trends.items():
            if len(values) < 3:
                continue

            trend_array = np.array(values)
            trend_direction = np.mean(np.diff(trend_array))

            # Detect concerning trends
            if abs(trend_direction) > 0.1:
                score = min(1.0, abs(trend_direction) * 2)
                explanation = (
                    f"{metric_name.replace('_', ' ').title()} showing "
                    f"{'increasing' if trend_direction > 0 else 'decreasing'} trend "
                    f"(rate: {trend_direction:.2f} units/min)"
                )
                
                risk_factors.append(
                    RiskFactors(
                        factor_name=f"Trend Analysis: {metric_name.replace('_', ' ').title()}",
                        factor_score=score,
                        weight=0.15,
                        description=explanation,
                        evidence={"trend_direction": float(trend_direction)},
                    )
                )

        return risk_factors

    def _calculate_overall_risk_score(self, risk_factors: list[RiskFactors]) -> float:
        """Calculate weighted overall risk score."""
        if not risk_factors:
            return 0.0

        total_weighted_score = sum(
            factor.factor_score * factor.weight for factor in risk_factors
        )
        total_weight = sum(factor.weight for factor in risk_factors)

        if total_weight > 0:
            return float(max(0.0, min(1.0, total_weighted_score / total_weight)))

        return 0.0

    def _determine_risk_level(self, risk_score: float) -> RiskLevel:
        """Determine risk level using configurable thresholds."""
        if risk_score >= self.thresholds.RISK_SCORE_HIGH:
            return RiskLevel.CRITICAL
        elif risk_score >= self.thresholds.RISK_SCORE_MODERATE:
            return RiskLevel.HIGH
        elif risk_score >= self.thresholds.RISK_SCORE_LOW:
            return RiskLevel.MODERATE
        else:
            return RiskLevel.LOW

    def _generate_primary_concerns(self, risk_factors: list[RiskFactors]) -> list[str]:
        """Generate explainable primary concerns from risk factors."""
        # Sort by weighted score
        sorted_factors = sorted(
            risk_factors,
            key=lambda f: f.factor_score * f.weight,
            reverse=True,
        )

        # Top 3 concerns with explanations
        concerns = [
            factor.description for factor in sorted_factors[:3] if factor.factor_score > 0.3
        ]

        if not concerns:
            concerns.append("No significant concerns identified - all metrics within normal ranges")

        return concerns

    def _generate_recommended_actions(
        self, risk_score: float, risk_level: RiskLevel, risk_factors: list[RiskFactors]
    ) -> list[str]:
        """Generate explainable recommended actions based on risk."""
        actions: list[str] = []

        # Base actions based on risk level
        if risk_level == RiskLevel.CRITICAL:
            actions.append("IMMEDIATE ACTION REQUIRED: Medical evaluation needed immediately")
            actions.append("Continuous monitoring recommended until risk level decreases")
        elif risk_level == RiskLevel.HIGH:
            actions.append("Close monitoring recommended for next 2-4 hours")
            actions.append("Consider medical consultation if risk factors persist")
        elif risk_level == RiskLevel.MODERATE:
            actions.append("Monitor closely for next 1-2 hours")
            actions.append("Review device status and signal quality")
        else:
            actions.append("Continue routine monitoring - risk level is low")

        # Add specific actions based on risk factors
        high_risk_factors = [
            f for f in risk_factors if f.factor_score > 0.6
        ]
        if high_risk_factors:
            for factor in high_risk_factors[:2]:
                if "heart" in factor.factor_name.lower():
                    actions.append(f"Monitor heart rate trends closely - {factor.description}")
                elif "temperature" in factor.factor_name.lower():
                    actions.append(f"Monitor temperature trends closely - {factor.description}")

        return actions

    def _calculate_confidence(
        self, risk_factors: list[RiskFactors], request: RiskScoringRequest
    ) -> float:
        """Calculate confidence in risk assessment."""
        # Base confidence on data availability
        confidence = 0.5

        # More data = higher confidence
        if request.historical_trends:
            confidence += 0.2

        if request.signal_quality_score is not None:
            confidence += 0.1

        if request.anomaly_flags:
            confidence += 0.1

        # More risk factors analyzed = higher confidence
        if len(risk_factors) >= 3:
            confidence += 0.1

        return float(max(0.0, min(1.0, confidence)))


# Global service instance (singleton pattern for deterministic behavior)
_risk_scoring_service: Optional[RiskScoringService] = None


def get_risk_scoring_service() -> RiskScoringService:
    """Get singleton instance of risk scoring service."""
    global _risk_scoring_service
    if _risk_scoring_service is None:
        _risk_scoring_service = RiskScoringService()
    return _risk_scoring_service
