# AI Services Integration - Implementation Summary

## Overview

AI microservices (FastAPI) have been integrated into the NestJS backend with async calls, fallback logic, explainable outputs, and persistent storage of AI decisions.

## What Was Implemented

### 1. Database Entity ✅
- **AiAnalysis Entity**: Stores all AI analysis results
- **Fields**: Results, explanations, recommendations, evidence, confidence scores
- **Status Tracking**: pending, completed, failed, fallback
- **Relationships**: Links to devices, inmate devices, and metrics

### 2. AI Service Client ✅
- **AiServiceClient**: HTTP client for FastAPI endpoints
- **Endpoints**: Signal quality, anomaly detection, risk scoring
- **Error Handling**: Timeout handling, error logging
- **Health Check**: Service availability check

### 3. AI Analysis Service ✅
- **AiAnalysisService**: Orchestrates AI calls and fallback logic
- **Methods**: analyzeSignalQuality, detectAnomalies, calculateRiskScore
- **Fallback Logic**: Basic algorithms when AI services unavailable
- **Persistence**: Saves all results with explainable outputs

### 4. Event Pipeline Integration ✅
- **Metric Processor**: Integrated AI analysis calls
- **Non-blocking**: AI analysis runs asynchronously
- **Time-series Data**: Fetches recent metrics for analysis
- **Automatic Triggering**: Runs on vital metric ingestion

### 5. Configuration ✅
- **AI Services URL**: Configurable endpoint
- **Timeout**: Configurable request timeout
- **Enable/Disable**: Can disable AI services via config

## File Structure

```
packages/api/src/
├── ai-integration/
│   ├── types/
│   │   └── ai-service.types.ts      # TypeScript interfaces
│   ├── services/
│   │   ├── ai-service-client.service.ts  # HTTP client
│   │   └── ai-analysis.service.ts   # Analysis orchestration
│   ├── ai-integration.module.ts     # Module configuration
│   └── README.md                    # Documentation
├── entities/
│   └── ai-analysis.entity.ts        # Database entity
└── event-pipeline/
    └── processors/
        └── metric-processor.processor.ts  # Integrated AI calls
```

## Data Flow

```
1. Vital Metric Ingested
   ↓
2. Event Published to BullMQ
   ↓
3. Metric Processor Receives Event
   ↓
4. Alert Rules Evaluated (existing)
   ↓
5. AI Analysis Triggered (new)
   ├─ Fetch Recent Metrics (last 5 minutes)
   ├─ Call Anomaly Detection API
   ├─ Call Risk Scoring API
   └─ Persist Results
   ↓
6. Fallback Used (if AI unavailable)
   └─ Basic threshold-based analysis
```

## AI Services Integration

### Signal Quality Assessment
- **When**: On vital metric ingestion
- **Input**: Signal data, sampling rate, signal type
- **Output**: Quality score, grade, metrics, recommendations
- **Fallback**: Variance-based quality scoring

### Anomaly Detection
- **When**: On vital metric ingestion
- **Input**: Time-series data, timestamps, baseline stats
- **Output**: Detected anomalies, risk score
- **Fallback**: Threshold-based detection (min/max ranges)

### Risk Scoring
- **When**: On vital metric ingestion
- **Input**: Current vitals, historical trends, anomaly flags
- **Output**: Risk score, level, factors, recommendations
- **Fallback**: Basic vital metric threshold checks

## Explainable Outputs

All AI analyses store:
- **Explanation**: Human-readable explanation
- **Recommendations**: List of recommended actions
- **Evidence**: Supporting data/context
- **Confidence**: Confidence score (0-1)
- **Quality Score**: Quality assessment (0-1)

Example:
```json
{
  "explanation": "Risk level: moderate (score: 0.65)",
  "recommendations": [
    "Monitor closely for next 2 hours",
    "Consider medical evaluation if trend continues"
  ],
  "evidence": {
    "riskFactors": [
      {
        "name": "Elevated Heart Rate",
        "score": 0.7,
        "description": "Heart rate trending upward"
      }
    ]
  },
  "confidence": 0.82
}
```

## Fallback Logic

When AI services are unavailable:

1. **Service Unavailable**: Connection/timeout errors
2. **Fallback Triggered**: Basic algorithms used
3. **Status Marked**: `status: 'fallback'`, `usedFallback: true`
4. **Lower Confidence**: Fallback results have lower confidence
5. **Results Stored**: All fallback results are persisted

### Fallback Algorithms

- **Signal Quality**: Variance-based scoring
- **Anomaly Detection**: Threshold checks (heart rate: 40-180, temperature: 35-40°C)
- **Risk Scoring**: Basic vital metric threshold checks

## Configuration

### Environment Variables

```env
AI_SERVICES_URL=http://localhost:8000
AI_SERVICES_TIMEOUT=10000
AI_SERVICES_ENABLED=true
```

### Configuration Service

```typescript
aiServices: {
  url: process.env.AI_SERVICES_URL || 'http://localhost:8000',
  timeout: parseInt(process.env.AI_SERVICES_TIMEOUT || '10000', 10),
  enabled: process.env.AI_SERVICES_ENABLED !== 'false',
}
```

## Failure Handling

### Error Types
1. **Connection Errors**: Network issues, service down
2. **Timeout Errors**: Request exceeds timeout
3. **HTTP Errors**: 4xx/5xx responses
4. **Parse Errors**: Invalid response format

### Handling Strategy
- **Log Errors**: All errors logged with details
- **Use Fallback**: Fallback logic triggered automatically
- **Persist Errors**: Error details stored in analysis record
- **Non-blocking**: Errors don't break main pipeline

## Performance Considerations

- **Async Processing**: AI analysis runs asynchronously
- **Non-blocking**: Doesn't delay metric processing
- **Batch Queries**: Fetches recent metrics efficiently
- **Timeout Protection**: Prevents hanging requests
- **Error Isolation**: AI failures don't affect alerts

## Testing

### Manual Testing

1. **Start AI Services**:
   ```bash
   cd packages/ai-services
   python run.py
   ```

2. **Start Backend**:
   ```bash
   cd packages/api
   pnpm start:dev
   ```

3. **Ingest Test Data**:
   ```bash
   curl -X POST http://localhost:3001/ingestion/ppg \
     -H "Content-Type: application/json" \
     -d '{
       "deviceSerial": "DEV-001",
       "recordedAt": "2024-01-15T10:30:00Z",
       "heartRate": 150
     }'
   ```

4. **Check Analysis Results**:
   ```sql
   SELECT * FROM ai_analyses 
   WHERE device_id = '<device-id>' 
   ORDER BY analyzed_at DESC;
   ```

## Database Migration

The `ai_analyses` table needs to be created. Add to your migration:

```sql
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  inmate_device_id UUID REFERENCES inmate_devices(id) ON DELETE SET NULL,
  analysis_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_analyses_device ON ai_analyses(device_id, recorded_at);
CREATE INDEX idx_ai_analyses_inmate_device ON ai_analyses(inmate_device_id, recorded_at) WHERE inmate_device_id IS NOT NULL;
CREATE INDEX idx_ai_analyses_type_status ON ai_analyses(analysis_type, status);
CREATE INDEX idx_ai_analyses_recorded_at ON ai_analyses(recorded_at DESC);
```

## Next Steps

1. **Database Migration**: Run migration to create `ai_analyses` table
2. **Testing**: Test with real data ingestion
3. **Monitoring**: Add metrics for AI service calls
4. **Optimization**: Consider caching recent analyses
5. **Enhancement**: Add WebSocket notifications for analysis results
