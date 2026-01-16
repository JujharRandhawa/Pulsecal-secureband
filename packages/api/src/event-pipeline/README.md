# Event Pipeline

Event-driven pipeline for processing device metrics and generating alerts.

## Architecture

```
Ingestion → Event Publisher → BullMQ Queue → Metric Processor → Alert Rules Engine → Alert Service → Database
```

## Components

### 1. Event Publisher Service
- Publishes metric ingestion events to BullMQ queues
- Ensures idempotency using idempotency keys
- Handles event serialization

### 2. BullMQ Queue
- **Queue Name**: `metric-events`
- **Job Type**: `process-metric`
- **Retry Policy**: 3 attempts with exponential backoff
- **Deduplication**: Uses idempotency key as job ID

### 3. Metric Processor
- Consumes events from the queue
- Evaluates alert rules
- Creates alerts via Alert Service

### 4. Alert Rules Engine
- Evaluates metrics against predefined rules
- Determines alert type and severity
- Generates idempotency keys for deduplication

### 5. Alert Service
- Creates alerts in database
- Ensures idempotent processing
- Prevents duplicate alerts (5-minute window)
- Creates alert history entries

### 6. Idempotency Service
- Tracks processed events
- Prevents duplicate processing
- Uses in-memory cache + database lookup

## Alert Rules

### Vital Metrics Rules

| Alert Type | Condition | Severity |
|------------|-----------|----------|
| `heart_rate_high` | HR > 120 bpm | Medium/High/Critical (based on value) |
| `heart_rate_low` | HR < 50 bpm | Medium/High/Critical (based on value) |
| `temperature_high` | Temp > 38.0°C | Medium/High/Critical (based on value) |
| `temperature_low` | Temp < 35.0°C | Medium/High/Critical (based on value) |
| `oxygen_saturation_low` | SpO2 < 95% | Medium/High/Critical (based on value) |
| `blood_pressure_high` | Systolic > 140 mmHg | Medium/High/Critical (based on value) |
| `blood_pressure_low` | Systolic < 90 mmHg | Medium/High/Critical (based on value) |

### Device Status Rules

| Alert Type | Condition | Severity |
|------------|-----------|----------|
| `battery_low` | Battery < 20% | Low/Medium/High (based on value) |
| `device_disconnected` | Connection status = 'disconnected' | High |
| `signal_loss` | Signal strength < -90 dBm | Medium |

## Severity Classification

- **Critical**: Life-threatening conditions (HR < 40, Temp > 39.5°C, SpO2 < 90%)
- **High**: Serious conditions requiring immediate attention
- **Medium**: Conditions requiring monitoring
- **Low**: Informational alerts (low battery)

## Idempotency

### Idempotency Key Generation
- Format: `{alertType}:{deviceId}:{roundedValue}:{roundedTimestamp}`
- Timestamp rounded to nearest minute
- Value rounded to reduce noise (e.g., HR rounded to nearest 10)

### Deduplication Strategy
1. **Job-level**: BullMQ uses idempotency key as job ID
2. **Alert-level**: Alert service checks for existing alerts within 5-minute window
3. **Database-level**: Idempotency key stored in alert_data for lookup

## Retry & Failure Handling

### Retry Configuration
- **Max Attempts**: 3
- **Backoff**: Exponential (starts at 2 seconds)
- **Failed Job Retention**: 7 days
- **Completed Job Retention**: 24 hours

### Failure Scenarios

1. **Queue Failure**: Job retries automatically
2. **Rule Evaluation Failure**: Logged, job continues
3. **Alert Creation Failure**: Logged, other alerts still processed
4. **Database Failure**: Job fails and retries

### Error Handling
- Errors are logged with full context
- Partial failures don't block other alerts
- Failed jobs are retained for manual inspection

## Event Flow

1. **Ingestion**: Device data ingested via API
2. **Storage**: Data saved to TimescaleDB
3. **Event Publishing**: Event published to BullMQ queue
4. **Queue Processing**: Worker picks up event
5. **Rule Evaluation**: Rules engine evaluates metrics
6. **Alert Creation**: Alerts created if rules match
7. **History Tracking**: Alert history entries created

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Queue Configuration

- **Connection**: Redis (configurable via ConfigService)
- **Concurrency**: Default (can be configured per processor)
- **Rate Limiting**: None (can be added if needed)

## Monitoring

### Metrics to Monitor
- Queue length
- Processing time
- Failed jobs count
- Alert creation rate
- Idempotency hit rate

### Logging
- All events are logged
- Errors include stack traces
- Idempotency checks are logged at debug level

## Testing

```typescript
// Test event publishing
await eventPublisher.publishMetricEvent({
  type: 'metric.ingested',
  metricId: 'metric-123',
  deviceId: 'device-123',
  inmateDeviceId: null,
  metricType: 'vital',
  data: {
    heartRate: 150,
    recordedAt: new Date(),
  },
});

// Test alert creation
await alertService.createAlert({
  deviceId: 'device-123',
  inmateDeviceId: null,
  alertType: AlertType.HEART_RATE_HIGH,
  severity: Severity.HIGH,
  description: 'Elevated heart rate',
  alertData: { heartRate: 150 },
  idempotencyKey: 'hr_high_device-123_150',
});
```

## Future Enhancements

- [ ] Custom alert rules via API
- [ ] Alert escalation rules
- [ ] Alert notification system
- [ ] Real-time alert dashboard
- [ ] Alert analytics and reporting
