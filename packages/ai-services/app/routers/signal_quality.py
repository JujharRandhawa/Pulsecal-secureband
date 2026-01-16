"""Signal quality assessment router."""

from fastapi import APIRouter, HTTPException
from app.schemas.signal_quality import SignalQualityRequest, SignalQualityResponse
from app.services.signal_quality_service import get_signal_quality_service

router = APIRouter()


@router.post("/signal-quality", response_model=SignalQualityResponse)
async def assess_signal_quality(
    request: SignalQualityRequest,
) -> SignalQualityResponse:
    """
    Assess signal quality for device data using fixed, versioned model.

    This endpoint analyzes signal data and provides quality metrics including:
    - Signal-to-noise ratio (SNR)
    - RMS error
    - Peak detection confidence
    - Baseline drift
    - Motion artifact score

    Returns an overall quality score, quality grade, and explainable recommendations.
    Model version is included in response for traceability.
    """
    try:
        service = get_signal_quality_service()
        response = service.assess_quality(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error assessing signal quality: {str(e)}",
        )
