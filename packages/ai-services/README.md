# PulseCal SecureBand AI Services

FastAPI microservice for AI-powered analysis of device data.

## Features

- ✅ Signal quality assessment
- ✅ Anomaly detection
- ✅ Risk scoring
- ✅ Clear API contracts with Pydantic schemas
- ✅ Placeholder inference logic (ready for ML model integration)

## Project Structure

```
app/
├── schemas/              # Pydantic schemas
│   ├── signal_quality.py
│   ├── anomaly_detection.py
│   └── risk_scoring.py
├── services/             # Business logic
│   ├── signal_quality_service.py
│   ├── anomaly_detection_service.py
│   └── risk_scoring_service.py
├── routers/              # API endpoints
│   ├── signal_quality.py
│   ├── anomaly_detection.py
│   └── risk_scoring.py
├── config.py             # Configuration
└── main.py               # Application entry point
```

## Installation

```bash
# Install dependencies
pip install -r requirements.txt
```

## Running the Service

```bash
# Development mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Signal Quality Assessment
- `POST /api/v1/signal-quality` - Assess signal quality

### Anomaly Detection
- `POST /api/v1/anomaly-detection` - Detect anomalies in time-series data

### Risk Scoring
- `POST /api/v1/risk-scoring` - Calculate risk scores

See [API_CONTRACTS.md](./API_CONTRACTS.md) for detailed API documentation.

## API Documentation

Once the service is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Current Implementation

The current implementation uses **placeholder inference logic** based on statistical methods:

- **Signal Quality**: Calculates SNR, RMS error, peak detection confidence, baseline drift, and motion artifacts
- **Anomaly Detection**: Uses Z-score analysis and trend detection
- **Risk Scoring**: Combines multiple risk factors with weighted scoring

## Future ML Integration

The service structure is designed to easily integrate ML models:

1. Replace placeholder methods in service classes with model inference
2. Add model loading in `config.py` or a separate model manager
3. Update requirements.txt with ML framework dependencies (e.g., scikit-learn, tensorflow, pytorch)

## Environment Variables

Create a `.env` file:

```env
HOST=0.0.0.0
PORT=8000
DEBUG=false
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
AI_MODEL_PATH=/path/to/models
AI_SERVICE_ENABLED=true
```

## Development

```bash
# Format code
black app/

# Lint code
ruff check app/

# Type checking
mypy app/
```

## Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app
```
