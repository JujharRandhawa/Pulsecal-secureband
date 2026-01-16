"""Anomaly detection router."""

from fastapi import APIRouter, HTTPException
from app.schemas.anomaly_detection import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
)
from app.services.anomaly_detection_service import get_anomaly_detection_service

router = APIRouter()


@router.post("/anomaly-detection", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
) -> AnomalyDetectionResponse:
    """
    Detect anomalies in time-series device data using fixed, versioned model.

    This endpoint analyzes time-series data for various types of anomalies:
    - Heart rate abnormalities
    - Temperature abnormalities
    - Motion anomalies
    - Signal loss
    - Device tampering
    - Pattern deviations

    Returns detected anomalies with severity, confidence scores, and explainable outputs.
    Model version is included in response for traceability.
    """
    try:
        service = get_anomaly_detection_service()
        response = service.detect_anomalies(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error detecting anomalies: {str(e)}",
        )
