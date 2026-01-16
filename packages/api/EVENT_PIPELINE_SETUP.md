# Event Pipeline Implementation Summary

## Overview

A complete event-driven pipeline has been implemented for processing device metrics and generating alerts using BullMQ.

## What Was Implemented

### 1. BullMQ Infrastructure ✅
- Queue setup with Redis backend
- Worker processors for metric events
- Retry and failure handling
- Job deduplication

### 2. Alert Rules Engine ✅
- Rule-based evaluation system
- Severity classification (Low/Medium/High/Critical)
- Multiple alert types (heart rate, temperature, oxygen, battery, etc.)
- Idempotency key generation

### 3. Alert Management ✅
- Alert entity and repository
- Alert history tracking
- Idempotent alert creation
- Duplicate prevention (5-minute window)

### 4. Event Pipeline ✅
- Event publisher service
- Metric processor worker
- Integration with ingestion service
- Automatic event publishing on metric ingestion

### 5. Idempotency ✅
- Multi-layer idempotency (job-level, alert-level, database-level)
- In-memory cache + database lookup
- Idempotency key generation

### 6. Retry & Failure Handling ✅
- Exponential backoff retry (3 attempts)
- Failed job retention (7 days)
- Error logging with context
- Graceful degradation

## File Structure

```
packages/api/src/event-pipeline/
├── types/
│   └── event.types.ts          # Event type definitions
├── rules/
│   └── alert-rules.engine.ts   # Alert rules engine
├── services/
│   ├── alert.service.ts        # Alert creation service
│   ├── idempotency.service.ts  # Idempotency management
│   └── event-publisher.service.ts  # Event publishing
├── processors/
│   └── metric-processor.processor.ts  # BullMQ worker
├── event-pipeline.module.ts    # Module configuration
└── README.md                   # Detailed documentation
```

## Event Flow

```
1. Device Data Ingestion
   ↓
2. Save to Database (TimescaleDB)
   ↓
3. Publish Event to Queue (BullMQ)
   ↓
4. Worker Processes Event
   ↓
5. Evaluate Alert Rules
   ↓
6. Create Alerts (if rules match)
   ↓
7. Store in Database
```

## Alert Rules

### Implemented Rules

1. **Heart Rate**
   - High: > 120 bpm (Medium/High/Critical)
   - Low: < 50 bpm (Medium/High/Critical)

2. **Temperature**
   - High: > 38.0°C (Medium/High/Critical)
   - Low: < 35.0°C (Medium/High/Critical)

3. **Oxygen Saturation**
   - Low: < 95% (Medium/High/Critical)

4. **Blood Pressure**
   - High: Systolic > 140 mmHg (Medium/High/Critical)
   - Low: Systolic < 90 mmHg (Medium/High/Critical)

5. **Battery**
   - Low: < 20% (Low/Medium/High)

6. **Device Status**
   - Disconnected: Connection status = 'disconnected' (High)
   - Signal Loss: Signal strength < -90 dBm (Medium)

## Severity Classification

- **Critical**: Life-threatening (HR < 40, Temp > 39.5°C, SpO2 < 90%)
- **High**: Serious conditions requiring immediate attention
- **Medium**: Conditions requiring monitoring
- **Low**: Informational alerts

## Idempotency Strategy

### Three-Layer Approach

1. **Job-Level**: BullMQ uses idempotency key as job ID
2. **Alert-Level**: Check for existing alerts within 5-minute window
3. **Database-Level**: Idempotency key stored in alert_data

### Key Generation

Format: `{alertType}:{deviceId}:{roundedValue}:{roundedTimestamp}`

Example: `hr_high_device-123_150` (heart rate high, device 123, rounded to 150)

## Retry Configuration

- **Max Attempts**: 3
- **Backoff**: Exponential (2s, 4s, 8s)
- **Failed Job Retention**: 7 days
- **Completed Job Retention**: 24 hours

## Dependencies Added

- `@nestjs/bullmq` - BullMQ integration for NestJS
- `bullmq` - Job queue library
- `ioredis` - Redis client

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Docker Compose

Redis service added to docker-compose.yml:
- Image: `redis:7-alpine`
- Port: `6379`
- Health checks configured

## Integration Points

### Ingestion Service Integration

- Events published automatically after metric ingestion
- Non-blocking (errors don't fail ingestion)
- Supports vital, location, and status metrics

### Database Integration

- Alert entity with full TypeORM support
- Alert history for audit trail
- Indexed for performance

## Testing

```bash
# Start Redis
docker-compose up redis -d

# Start API
pnpm start:dev

# Ingest data (triggers events automatically)
curl -X POST http://localhost:3001/ingestion/ppg \
  -H "Content-Type: application/json" \
  -d '{
    "deviceSerial": "DEV-001",
    "recordedAt": "2024-01-15T10:30:00Z",
    "heartRate": 150
  }'
```

## Monitoring

### Queue Metrics
- Queue length
- Processing time
- Failed jobs
- Completed jobs

### Alert Metrics
- Alert creation rate
- Alert types distribution
- Severity distribution
- Idempotency hit rate

## Future Enhancements

- Custom alert rules via API
- Alert escalation rules
- Notification system integration
- Real-time alert streaming
- Alert analytics dashboard
