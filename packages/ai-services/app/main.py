"""FastAPI application entry point."""

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    health,
    signal_quality,
    anomaly_detection,
    risk_scoring,
)

# Configure logging
log_level = os.getenv("LOG_LEVEL", "info").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Disable debug in production
if os.getenv("NODE_ENV") == "production" or not settings.DEBUG:
    import warnings
    warnings.filterwarnings("ignore")
    os.environ["PYTHONWARNINGS"] = "ignore"

app = FastAPI(
    title="PulseCal SecureBand AI Services",
    description="AI Services API for government wearable monitoring platform",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,  # Disable docs in production
    redoc_url="/api/redoc" if settings.DEBUG else None,  # Disable redoc in production
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(
    signal_quality.router, prefix="/api/v1", tags=["signal-quality"]
)
app.include_router(
    anomaly_detection.router, prefix="/api/v1", tags=["anomaly-detection"]
)
app.include_router(risk_scoring.router, prefix="/api/v1", tags=["risk-scoring"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "PulseCal SecureBand AI Services"}
