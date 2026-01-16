# Observability Stack

Production-ready observability stack with logging, metrics, tracing, and rate limiting.

## Components

### 1. Central Logging
- **Winston**: Structured JSON logging
- **File Rotation**: Daily rotating log files
- **Error Handling**: Separate error and exception logs
- **Log Aggregation**: Ready for ELK/Logstash

### 2. Prometheus Metrics
- **HTTP Metrics**: Request duration, counts, errors
- **Business Metrics**: Ingestion, alerts, AI analyses
- **System Metrics**: Memory, disk, connections, queues
- **Metrics Endpoint**: `/metrics` for Prometheus scraping

### 3. OpenTelemetry Tracing
- **Distributed Tracing**: Automatic instrumentation
- **Jaeger Export**: Trace collection and analysis
- **Service Context**: Service name and version tracking

### 4. Rate Limiting
- **Throttler Guard**: Global rate limiting
- **Configurable**: Per-route customization
- **In-memory**: Fast, can extend with Redis

### 5. Health Dashboards
- **Comprehensive Checks**: Database, Redis, AI services, system
- **Kubernetes Ready**: Liveness, readiness, startup probes
- **Multiple Endpoints**: Full health, liveness, readiness, startup

## Usage

### Metrics

```typescript
import { MetricsService } from './observability/metrics/metrics.service';

// Increment business metric
this.metricsService.metricsIngested.inc({
  metric_type: 'vital',
  device_id: deviceId,
});

// Record duration
const end = this.metricsService.httpRequestDuration.startTimer();
// ... do work ...
end({ method: 'POST', route: '/ingestion/ppg', status_code: '200' });
```

### Tracing

Tracing is automatic via OpenTelemetry instrumentation. No manual code needed.

### Rate Limiting

```typescript
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('api')
export class ApiController {}
```

## Configuration

See `PRODUCTION_HARDENING.md` for full configuration options.
