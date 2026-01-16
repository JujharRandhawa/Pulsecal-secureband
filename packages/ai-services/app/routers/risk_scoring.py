"""Risk scoring router."""

from fastapi import APIRouter, HTTPException
from app.schemas.risk_scoring import RiskScoringRequest, RiskScoringResponse
from app.services.risk_scoring_service import get_risk_scoring_service

router = APIRouter()


@router.post("/risk-scoring", response_model=RiskScoringResponse)
async def calculate_risk_score(
    request: RiskScoringRequest,
) -> RiskScoringResponse:
    """
    Calculate risk score for device/inmate monitoring using fixed, versioned model.

    This endpoint performs comprehensive risk assessment based on:
    - Current vital metrics (using configurable thresholds)
    - Historical trends
    - Detected anomalies
    - Signal quality

    Returns overall risk score, risk level, contributing factors,
    primary concerns, recommended actions, and confidence score.
    Model version is included in response for traceability.
    """
    try:
        service = get_risk_scoring_service()
        response = service.calculate_risk(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error calculating risk score: {str(e)}",
        )
