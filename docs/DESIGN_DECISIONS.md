# Design Decisions - PulseCal SecureBand

This document explains the key architectural decisions and their rationale.

## 1. Event-Driven Architecture

### Decision
Use an asynchronous event-driven architecture with message queues (RabbitMQ/Kafka) instead of synchronous request-response patterns for data processing.

### Rationale
1. **Decoupling**: Services can evolve independently without tight coupling
2. **Resilience**: Message persistence ensures no data loss during failures
3. **Scalability**: Can scale consumers independently based on workload
4. **Real-time Processing**: AI services can process data without blocking API responses
5. **Multiple Consumers**: Same event can trigger alerts, analytics, and archiving simultaneously

### Trade-offs
- ✅ **Pros**: High throughput, fault tolerance, flexible processing
- ❌ **Cons**: Eventual consistency, added complexity, debugging challenges

### Alternatives Considered
- **Synchronous REST**: Rejected due to tight coupling and blocking behavior
- **gRPC**: Considered but rejected due to complexity and lack of persistence
- **Direct Database Writes**: Rejected due to lack of decoupling and scalability

---

## 2. BLE Gateway as Edge Device

### Decision
Deploy physical gateway devices (Raspberry Pi or industrial hardware) in prison facilities to aggregate BLE data before transmission.

### Rationale
1. **BLE Range Limitation**: BLE has ~10m range, requires proximity
2. **Network Efficiency**: Aggregates data, reducing network traffic by 90%+
3. **Offline Capability**: Local buffering enables operation during network outages
4. **Retry Logic**: Gateway can retry failed transmissions without device involvement
5. **Data Validation**: Pre-validates data before sending to reduce backend load

### Trade-offs
- ✅ **Pros**: Reduced latency, offline operation, network efficiency
- ❌ **Cons**: Hardware deployment cost, maintenance overhead, single point of failure

### Mitigation
- Deploy redundant gateways per facility
- Health monitoring and automatic failover
- Remote management and updates

---

## 3. PostgreSQL + TimescaleDB for Time-Series Data

### Decision
Use PostgreSQL with TimescaleDB extension instead of specialized time-series databases (InfluxDB, TimescaleDB standalone).

### Rationale
1. **SQL Familiarity**: Team expertise in SQL, easier onboarding
2. **Dual Purpose**: Handles both relational (metadata) and time-series (metrics) data
3. **ACID Compliance**: Strong consistency guarantees for critical data
4. **Automatic Partitioning**: TimescaleDB handles time-based partitioning automatically
5. **Compression**: 90%+ compression ratio for historical data
6. **Ecosystem**: Rich tooling, monitoring, and backup solutions

### Trade-offs
- ✅ **Pros**: Single database, SQL queries, ACID guarantees
- ❌ **Cons**: Less specialized than pure time-series DBs, higher memory usage

### Alternatives Considered
- **InfluxDB**: Rejected due to learning curve and limited relational capabilities
- **MongoDB**: Rejected due to lack of time-series optimization
- **Cassandra**: Rejected due to complexity and eventual consistency model

---

## 4. Microservices Architecture

### Decision
Separate the system into independent microservices (API, AI Services, Web) rather than a monolithic application.

### Rationale
1. **Technology Diversity**: Use best tool for each job (NestJS for API, FastAPI for AI, Next.js for web)
2. **Independent Scaling**: Scale AI workers independently based on queue depth
3. **Fault Isolation**: Failure in one service doesn't cascade to others
4. **Team Autonomy**: Different teams can own and deploy services independently
5. **Deployment Flexibility**: Deploy updates to one service without affecting others

### Trade-offs
- ✅ **Pros**: Flexibility, scalability, technology choice
- ❌ **Cons**: Network overhead, distributed complexity, service discovery

### Service Boundaries
- **API Service**: Business logic, data validation, orchestration
- **AI Service**: ML model inference, anomaly detection, pattern recognition
- **Web Service**: UI rendering, client-side state management

---

## 5. JWT Authentication with Refresh Tokens

### Decision
Use JWT tokens with short expiry (15 minutes) combined with refresh tokens (7 days) for authentication.

### Rationale
1. **Stateless**: No server-side session storage, scales horizontally
2. **Industry Standard**: Well-understood, extensive tooling
3. **Security**: Short-lived access tokens limit exposure window
4. **Performance**: No database lookup for token validation
5. **Refresh Pattern**: Enables secure long sessions without frequent re-authentication

### Trade-offs
- ✅ **Pros**: Scalable, standard, performant
- ❌ **Cons**: Token revocation requires blacklist (Redis), larger token size

### Token Structure
- **Access Token**: Contains user ID, roles, permissions (signed, 15min expiry)
- **Refresh Token**: Opaque token stored in database (hashed, 7-day expiry)
- **Revocation**: Refresh token blacklist in Redis for immediate revocation

---

## 6. Circuit Breaker Pattern

### Decision
Implement circuit breakers for all external service calls (database, event bus, AI services).

### Rationale
1. **Cascade Prevention**: Prevents one failing service from bringing down others
2. **Fast Failure**: Fails fast instead of waiting for timeouts
3. **Automatic Recovery**: Tests service health periodically
4. **Resource Protection**: Prevents overwhelming failing services with requests
5. **Observability**: Circuit state provides clear health indicators

### Implementation
- **States**: Closed (normal), Open (failing), Half-Open (testing)
- **Threshold**: 5 failures in 60 seconds → Open
- **Timeout**: 30 seconds before attempting Half-Open
- **Fallback**: Return cached data or error message

### Trade-offs
- ✅ **Pros**: Resilience, fast failure detection, resource protection
- ❌ **Cons**: Additional complexity, potential false positives

---

## 7. Multi-Layer Caching Strategy

### Decision
Implement caching at multiple layers: browser, CDN, Redis, and application-level.

### Rationale
1. **Performance**: Reduces database load and improves response times
2. **Cost Efficiency**: Fewer database queries = lower infrastructure costs
3. **User Experience**: Faster page loads and API responses
4. **Scalability**: Caching reduces backend load, enabling horizontal scaling

### Cache Layers
1. **Browser Cache**: Static assets (1 hour TTL)
2. **CDN Cache**: API responses (5 minutes TTL)
3. **Redis Cache**: Frequently queried data (1-60 minutes TTL)
4. **Application Cache**: In-memory cache (30 seconds TTL)

### Cache Invalidation
- **Time-based**: TTL expiration
- **Event-based**: Invalidate on data updates
- **Manual**: Admin-triggered cache clear

---

## 8. Horizontal Scaling with Kubernetes

### Decision
Use Kubernetes for container orchestration and auto-scaling instead of manual scaling or simpler orchestration.

### Rationale
1. **Auto-Scaling**: Horizontal Pod Autoscaler (HPA) based on CPU/memory/metrics
2. **High Availability**: Automatic pod restart, health checks, rolling updates
3. **Service Discovery**: Built-in DNS-based service discovery
4. **Resource Management**: CPU/memory limits and requests
5. **Rolling Updates**: Zero-downtime deployments
6. **Industry Standard**: Extensive tooling and community support

### Scaling Triggers
- **CPU**: > 70% for 5 minutes
- **Memory**: > 80% for 5 minutes
- **Request Queue**: > 1000 pending requests
- **Response Time**: > 500ms p95 latency

### Trade-offs
- ✅ **Pros**: Auto-scaling, HA, standard platform
- ❌ **Cons**: Learning curve, operational complexity

---

## 9. Defense in Depth Security

### Decision
Implement multiple security layers rather than relying on a single security mechanism.

### Rationale
1. **Risk Mitigation**: If one layer fails, others provide protection
2. **Compliance**: Meets government security requirements (NIST, FIPS)
3. **Attack Surface Reduction**: Multiple barriers make attacks harder
4. **Audit Trail**: Multiple layers provide comprehensive logging

### Security Layers
1. **Device**: Hardware tamper detection, encrypted storage
2. **Transport**: TLS 1.3, certificate pinning
3. **Network**: VPN, firewall, network segmentation
4. **API**: Authentication (JWT), authorization (RBAC), rate limiting
5. **Database**: Encryption at rest, field-level encryption, row-level security
6. **Audit**: Immutable audit logs, compliance reporting

### Trade-offs
- ✅ **Pros**: Strong security, compliance, defense against multiple attack vectors
- ❌ **Cons**: Increased complexity, potential performance impact

---

## 10. Offline-First Gateway Design

### Decision
Design gateways to operate in offline mode with local buffering and automatic sync when connectivity is restored.

### Rationale
1. **Network Reliability**: Prison facilities may have intermittent connectivity
2. **Data Loss Prevention**: Local buffer prevents data loss during outages
3. **Resilience**: System continues operating during network issues
4. **Compliance**: No data loss meets regulatory requirements

### Implementation
- **Local Storage**: SQLite database on gateway (24-hour buffer)
- **Retry Logic**: Exponential backoff for failed transmissions
- **Sync Strategy**: Batch upload when connectivity restored
- **Conflict Resolution**: Timestamp-based ordering

### Trade-offs
- ✅ **Pros**: Resilience, data integrity, continuous operation
- ❌ **Cons**: Storage requirements, sync complexity

---

## 11. Real-time Dashboard with WebSocket Fallback

### Decision
Use WebSocket for real-time updates with HTTP polling as fallback.

### Rationale
1. **Real-time Requirements**: Alerts must be delivered immediately (< 500ms)
2. **Efficiency**: WebSocket reduces server load vs. constant polling
3. **User Experience**: Instant updates improve monitoring effectiveness
4. **Fallback**: HTTP polling ensures functionality if WebSocket fails

### Implementation
- **Primary**: WebSocket connection for real-time events
- **Fallback**: HTTP polling every 5 seconds if WebSocket unavailable
- **Reconnection**: Automatic reconnection with exponential backoff
- **Message Queue**: Server-side queue for missed messages during disconnection

### Trade-offs
- ✅ **Pros**: Real-time updates, efficient, reliable
- ❌ **Cons**: Connection management complexity, firewall issues

---

## 12. TimescaleDB Automatic Partitioning

### Decision
Use TimescaleDB's automatic time-based partitioning instead of manual partitioning.

### Rationale
1. **Automation**: Reduces operational overhead
2. **Query Optimization**: Automatic query planning across partitions
3. **Data Retention**: Easy to drop old partitions for data retention policies
4. **Compression**: Automatic compression of old partitions
5. **Transparency**: Applications don't need partition awareness

### Partition Strategy
- **Interval**: 1 day per partition
- **Retention**: 90 days hot, 1 year warm, archive older
- **Compression**: Compress partitions older than 7 days
- **Query Performance**: Automatic query planning uses only relevant partitions

### Trade-offs
- ✅ **Pros**: Automatic management, optimized queries, easy retention
- ❌ **Cons**: Less control over partitioning strategy

---

## Summary

These design decisions prioritize:
1. **Reliability**: Event-driven architecture, circuit breakers, offline capability
2. **Security**: Defense in depth, encryption, authentication
3. **Scalability**: Horizontal scaling, caching, microservices
4. **Performance**: Caching, partitioning, async processing
5. **Maintainability**: Standard patterns, clear boundaries, observability

Each decision balances trade-offs to meet the requirements of a government-grade, prison monitoring system with high availability, security, and scalability needs.
