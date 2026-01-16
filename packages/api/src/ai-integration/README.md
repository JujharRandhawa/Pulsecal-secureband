# AI Services Integration

Integration with FastAPI AI microservices for signal quality assessment, anomaly detection, and risk scoring.

## Architecture

```
Metric Ingestion → Event Pipeline → Metric Processor → AI Analysis Service → AI Microservices (FastAPI)
                                                      ↓
                                              Fallback Logic (if AI unavailable)
                                                      ↓
                                              Persist Results (ai_analyses table)
```

## Components

### AiServiceClient
- HTTP client for calling AI microservices
- Handles timeouts and errors
- Provides health check endpoint

### AiAnalysisService
- Orchestrates AI analysis calls
- Implements fallback logic when AI services are unavailable
- Persists analysis results with explainable outputs

### AiAnalysis Entity
- Stores all AI analysis results
- Tracks status (pending, completed, failed, fallback)
- Stores explanations, recommendations, and evidence
- Links to metrics and devices

## AI Services

### 1. Signal Quality Assessment
- **Endpoint**: `POST /api/v1/signal-quality`
- **Purpose**: Assess quality of sensor signals
- **Fallback**: Basic statistical analysis (variance-based)

### 2. Anomaly Detection
- **Endpoint**: `POST /api/v1/anomaly-detection`
- **Purpose**: Detect anomalies in time-series data
- **Fallback**: Threshold-based detection (simple min/max checks)

### 3. Risk Scoring
- **Endpoint**: `POST /api/v1/risk-scoring`
- **Purpose**: Calculate overall risk score
- **Fallback**: Basic risk scoring based on vital metric thresholds

## Data Flow

1. **Metric Ingestion**: Vital metrics are ingested and stored
2. **Event Publishing**: Metric event is published to BullMQ
3. **Metric Processing**: Metric processor receives event
4. **AI Analysis Trigger**: Processor triggers AI analysis (non-blocking)
5. **Recent Metrics Query**: Fetches recent metrics for time-series analysis
6. **AI Service Calls**: Calls AI microservices (anomaly detection, risk scoring)
7. **Fallback Logic**: If AI services fail, uses fallback algorithms
8. **Result Persistence**: Stores analysis results with explanations

## Explainable Outputs

All AI analyses store:
- **Explanation**: Human-readable explanation of the analysis
- **Recommendations**: List of recommended actions
- **Evidence**: Supporting data/context for the decision
- **Confidence**: Confidence score (0-1)
- **Quality Score**: Quality assessment (0-1)

## Fallback Logic

When AI services are unavailable:
1. **Signal Quality**: Uses variance-based quality scoring
2. **Anomaly Detection**: Uses threshold-based detection (min/max ranges)
3. **Risk Scoring**: Uses basic vital metric threshold checks

Fallback results are marked with:
- `status: 'fallback'`
- `usedFallback: true`
- `fallbackReason: <error message>`
- Lower confidence scores

## Configuration

```env
AI_SERVICES_URL=http://localhost:8000
AI_SERVICES_TIMEOUT=10000
AI_SERVICES_ENABLED=true
```

## Usage

AI analysis is automatically triggered when vital metrics are ingested. The analysis runs asynchronously and does not block the main processing pipeline.

### Manual Analysis

```typescript
// Signal quality
await aiAnalysisService.analyzeSignalQuality(
  request,
  metricId,
  deviceId,
  inmateDeviceId,
  recordedAt,
);

// Anomaly detection
await aiAnalysisService.detectAnomalies(
  request,
  metricId,
  deviceId,
  inmateDeviceId,
  recordedAt,
);

// Risk scoring
await aiAnalysisService.calculateRiskScore(
  request,
  metricId,
  deviceId,
  inmateDeviceId,
  recordedAt,
);
```

## Error Handling

- **Timeout**: 10 seconds default (configurable)
- **Connection Errors**: Logged and fallback used
- **HTTP Errors**: Logged with status code
- **Analysis Failures**: Stored with error details, fallback used

## Performance

- **Non-blocking**: AI analysis runs asynchronously
- **Batch Processing**: Analyzes recent metrics (last 5 minutes)
- **Caching**: Can be extended with caching layer
- **Rate Limiting**: Can be added if needed

## Database Schema

```sql
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL,
  inmate_device_id UUID,
  analysis_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  metric_id UUID,
  recorded_at TIMESTAMPTZ NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL,
  results JSONB,
  explanation TEXT,
  recommendations TEXT[],
  evidence JSONB,
  confidence DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  error_message TEXT,
  error_details JSONB,
  used_fallback BOOLEAN DEFAULT false,
  fallback_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
```

## Future Enhancements

- [ ] Caching layer for recent analyses
- [ ] Batch analysis for multiple metrics
- [ ] WebSocket notifications for analysis results
- [ ] Analysis result aggregation
- [ ] Machine learning model versioning
- [ ] A/B testing for different models
