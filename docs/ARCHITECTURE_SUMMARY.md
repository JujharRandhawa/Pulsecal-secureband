# PulseCal SecureBand - Architecture Summary

## System at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRISON FACILITY (Edge)                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │Wearable 1│  │Wearable 2│  │Wearable N│                      │
│  │(nRF BLE) │  │(nRF BLE) │  │(nRF BLE) │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       │            │            │                              │
│       └────────────┼────────────┘                              │
│                    │                                            │
│            ┌───────▼───────┐                                   │
│            │ BLE Gateway   │                                   │
│            │ (Edge Device)  │                                   │
│            └───────┬───────┘                                   │
└────────────────────┼──────────────────────────────────────────┘
                     │ HTTPS/TLS
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              SECURE NETWORK (VPN Tunnel)                         │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              GOVERNMENT DATA CENTER                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Gateway / Load Balancer                 │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
│    ┌────────────────────┼────────────────────┐                 │
│    │                    │                    │                 │
│ ┌──▼──────┐      ┌──────▼──────┐    ┌───────▼──────┐         │
│ │ Backend │      │  Event Bus   │    │  AI Services │         │
│ │   API   │◄─────┤ (RabbitMQ/   │───►│  (FastAPI)   │         │
│ │(NestJS) │      │   Kafka)     │    │              │         │
│ └──┬──────┘      └──────┬───────┘    └───────┬──────┘         │
│    │                    │                    │                 │
│    │            ┌───────▼────────┐          │                 │
│    │            │   Database     │          │                 │
│    │            │ (PostgreSQL +  │          │                 │
│    │            │  TimescaleDB)  │          │                 │
│    │            └────────────────┘          │                 │
│    │                                          │                 │
│ ┌──▼──────────────────────────────────────────▼──────┐         │
│ │         Web Dashboard (Next.js)                    │         │
│ └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow (Event-Driven)

```
┌─────────┐
│Wearable │──BLE──►┌─────────┐
└─────────┘        │Gateway  │──HTTPS──►┌──────┐
                   └─────────┘          │ API  │──►┌──────────┐
                                        └──┬───┘   │Event Bus │
                                           │       └────┬─────┘
                                           │            │
                                           ▼            ▼
                                      ┌────────┐   ┌────────┐
                                      │Database│   │   AI   │
                                      └────────┘   └────┬───┘
                                                        │
                                                        ▼
                                                   ┌─────────┐
                                                   │Dashboard│
                                                   └─────────┘
```

## Key Metrics

| Metric | Target | Status |
|--------|--------|--------|
| **Devices Supported** | 10,000+ | Scalable |
| **API Response Time** | < 200ms (p95) | Achievable |
| **Event Processing** | < 1s (p95) | Achievable |
| **Alert Delivery** | < 500ms | Achievable |
| **Throughput** | 10,000 events/sec | Achievable |
| **Uptime** | 99.9% | Target |

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│ Layer              │ Technology                         │
├─────────────────────────────────────────────────────────┤
│ Wearable           │ nRF52840 (BLE 5.0)                 │
│ Gateway            │ Raspberry Pi / Industrial          │
│ API                │ NestJS (TypeScript)                │
│ AI Services        │ FastAPI (Python)                   │
│ Frontend           │ Next.js (React)                     │
│ Database           │ PostgreSQL + TimescaleDB           │
│ Cache              │ Redis                               │
│ Message Queue      │ RabbitMQ / Kafka                   │
│ Orchestration      │ Kubernetes                          │
│ Monitoring         │ Prometheus + Grafana                │
│ Logging            │ ELK Stack                           │
└─────────────────────────────────────────────────────────┘
```

## Security Layers

```
Layer 1: Device Security
  ├─ Hardware tamper detection
  ├─ Encrypted storage
  └─ Secure boot

Layer 2: Transport Security
  ├─ TLS 1.3 encryption
  ├─ Certificate pinning
  └─ VPN tunnel

Layer 3: Network Security
  ├─ Firewall rules
  ├─ Network segmentation
  └─ IDS/IPS

Layer 4: Application Security
  ├─ JWT authentication
  ├─ RBAC authorization
  └─ Rate limiting

Layer 5: Data Security
  ├─ Encryption at rest
  ├─ Field-level encryption
  └─ Key management
```

## Failure Handling

```
Failure Type          │ Mitigation Strategy
──────────────────────┼────────────────────────────────────
Wearable Failure      │ Local buffer, retry queue
Gateway Failure       │ Redundant gateways, failover
Network Outage        │ Offline mode, sync on reconnect
API Failure           │ Load balancing, circuit breaker
Database Failure      │ Replication, read replicas
AI Service Failure    │ Dead letter queue, manual review
```

## Scaling Strategy

```
Component          │ Initial │ Target  │ Method
───────────────────┼─────────┼─────────┼────────────────────
Wearable Devices   │ 100     │ 10,000  │ Add gateways (1:100)
BLE Gateways       │ 1       │ 100     │ Physical deployment
API Instances      │ 2       │ 50      │ K8s HPA (CPU/Memory)
Database           │ 1       │ 1+5     │ Read replicas
Event Bus          │ 1       │ 3       │ Clustering
AI Workers         │ 2       │ 20      │ Queue-based scaling
Web Instances      │ 2       │ 10      │ K8s HPA (Request rate)
```

## Event Types

```
┌─────────────────────────────────────────────────────────┐
│ Event Category      │ Event Types                       │
├─────────────────────────────────────────────────────────┤
│ Telemetry           │ telemetry.received                 │
│                     │ telemetry.batch                    │
├─────────────────────────────────────────────────────────┤
│ Alerts              │ alert.triggered                    │
│                     │ alert.resolved                     │
│                     │ alert.escalated                    │
├─────────────────────────────────────────────────────────┤
│ Analysis            │ analysis.completed                 │
│                     │ pattern.detected                   │
├─────────────────────────────────────────────────────────┤
│ System              │ device.connected                  │
│                     │ device.disconnected                │
│                     │ gateway.health                     │
└─────────────────────────────────────────────────────────┘
```

## Architecture Principles

1. **Event-Driven**: Async processing via message queues
2. **Microservices**: Independent scaling and deployment
3. **Defense in Depth**: Multiple security layers
4. **Fail-Safe**: Graceful degradation, circuit breakers
5. **Observable**: Metrics, logs, traces
6. **Scalable**: Horizontal scaling from 100 to 10,000+ devices
7. **Secure**: Government-grade security and compliance

---

## Documentation Index

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture documentation
- **[ARCHITECTURE_QUICK_REFERENCE.md](./ARCHITECTURE_QUICK_REFERENCE.md)** - Quick reference guide
- **[DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)** - Detailed design rationale

---

**Status**: Architecture design complete. Ready for implementation.
