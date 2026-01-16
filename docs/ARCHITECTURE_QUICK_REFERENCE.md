# PulseCal SecureBand - Architecture Quick Reference

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PRISON FACILITY                           │
│                                                             │
│  [Wearables] ──BLE──> [Gateway] ──HTTPS──> [VPN Tunnel]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  GOVERNMENT DATA CENTER                      │
│                                                             │
│  [Load Balancer] ──> [API Gateway]                          │
│                            │                                │
│        ┌───────────────────┼───────────────────┐           │
│        │                   │                   │           │
│     [API]              [Event Bus]          [AI]          │
│        │                   │                   │           │
│        └───────────────────┼───────────────────┘           │
│                            │                                │
│                    [Database Cluster]                      │
│                            │                                │
│                        [Dashboard]                         │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Wearable** | nRF52840 | BLE data collection |
| **Gateway** | Raspberry Pi | Edge aggregation |
| **API** | NestJS | Business logic, REST API |
| **AI Services** | FastAPI | ML/AI processing |
| **Web** | Next.js | Dashboard UI |
| **Database** | PostgreSQL + TimescaleDB | Time-series storage |
| **Event Bus** | RabbitMQ/Kafka | Async messaging |
| **Cache** | Redis | Performance optimization |

## Data Flow

```
Wearable → Gateway → API → Event Bus → AI Services
                ↓         ↓              ↓
              Buffer   Database      Analysis
                ↓         ↓              ↓
              Retry   TimescaleDB   Alerts
```

## Failure Handling

| Failure Point | Mitigation |
|---------------|------------|
| Wearable | Local buffer, retry queue |
| Gateway | Redundant gateways, failover |
| Network | Offline mode, sync on reconnect |
| API | Load balancing, circuit breaker |
| Database | Replication, read replicas |
| AI Service | Dead letter queue, manual review |

## Security Layers

1. **Device**: Tamper detection, encrypted storage
2. **Transport**: TLS 1.3, certificate pinning
3. **Network**: VPN, firewall, segmentation
4. **API**: JWT authentication, RBAC
5. **Database**: Encryption at rest, field-level encryption

## Scaling Strategy

- **Stateless Services**: Horizontal scaling (K8s HPA)
- **Database**: Read replicas + sharding
- **Event Bus**: Clustering (3-node)
- **AI Workers**: Queue depth-based scaling
- **Gateways**: 1 gateway per 100 devices

## Performance Targets

- API Response: < 200ms (p95)
- Event Processing: < 1s (p95)
- Database Query: < 100ms (p95)
- Alert Delivery: < 500ms
- Throughput: 10,000 events/sec

## Event Types

- `telemetry.received` - Device data received
- `alert.triggered` - Anomaly detected
- `analysis.completed` - AI processing done
- `device.connected` - Device online
- `device.disconnected` - Device offline

## Architecture Principles

1. **Event-Driven**: Async processing via message queue
2. **Microservices**: Independent scaling and deployment
3. **Defense in Depth**: Multiple security layers
4. **Fail-Safe**: Graceful degradation, circuit breakers
5. **Observable**: Metrics, logs, traces

---

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md)
