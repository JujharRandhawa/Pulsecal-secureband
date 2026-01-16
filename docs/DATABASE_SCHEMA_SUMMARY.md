# PulseCal SecureBand - Database Schema Summary

## Quick Reference

### Table Categories

```
┌─────────────────────────────────────────────────────────┐
│  Core Reference Tables                                   │
├─────────────────────────────────────────────────────────┤
│  • facilities      - Prison facilities                  │
│  • zones           - Areas within facilities            │
│  • gateways        - BLE aggregation devices            │
│  • devices         - Wearable hardware                  │
│  • inmates         - Prisoner profiles (minimal PII)   │
│  • inmate_devices  - Device assignments                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Time-Series Tables (TimescaleDB Hypertables)         │
├─────────────────────────────────────────────────────────┤
│  • vital_metrics   - Heart rate, temperature, etc.     │
│  • location_metrics - Position tracking                │
│  • device_status   - Device connection health           │
│  • gateway_status  - Gateway health                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Alert and Event Tables                                 │
├─────────────────────────────────────────────────────────┤
│  • alerts          - Anomaly alerts                     │
│  • alert_history   - Alert audit trail                  │
│  • tamper_events   - Tampering detection                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Audit Tables                                           │
├─────────────────────────────────────────────────────────┤
│  • audit_log       - Immutable change log               │
└─────────────────────────────────────────────────────────┘
```

## Entity Relationships

```
facilities (1) ──< (N) zones
facilities (1) ──< (N) gateways
facilities (1) ──< (N) inmates

zones (1) ──< (N) inmates

inmates (1) ──< (N) inmate_devices
devices (1) ──< (N) inmate_devices

devices (1) ──< (N) vital_metrics
devices (1) ──< (N) location_metrics
devices (1) ──< (N) device_status
devices (1) ──< (N) alerts
devices (1) ──< (N) tamper_events

inmate_devices (1) ──< (N) vital_metrics
inmate_devices (1) ──< (N) location_metrics
inmate_devices (1) ──< (N) alerts

alerts (1) ──< (N) alert_history

gateways (1) ──< (N) device_status
gateways (1) ──< (N) gateway_status
```

## Key Tables

### 1. Facilities
- **Purpose**: Prison facilities
- **Key Fields**: `code`, `name`, `address_encrypted`
- **Indexes**: `code` (unique), `is_active`

### 2. Devices
- **Purpose**: Wearable hardware inventory
- **Key Fields**: `serial_number`, `mac_address`, `status`
- **Indexes**: `serial_number` (unique), `mac_address` (unique), `status`

### 3. Inmates
- **Purpose**: Prisoner profiles (minimal PII)
- **Key Fields**: `inmate_number`, `first_name_encrypted`, `last_name_encrypted`
- **Indexes**: `inmate_number` (unique), `facility_id`, `status`

### 4. Vital Metrics (Hypertable)
- **Purpose**: Time-series health data
- **Key Fields**: `device_id`, `recorded_at`, `heart_rate`, `temperature_celsius`
- **Partitioning**: 1 day chunks
- **Retention**: 90 days hot, 1 year warm
- **Compression**: After 7 days

### 5. Location Metrics (Hypertable)
- **Purpose**: Time-series position data
- **Key Fields**: `device_id`, `recorded_at`, `zone_id`, `x_coordinate`, `y_coordinate`
- **Partitioning**: 1 day chunks
- **Retention**: 90 days hot, 1 year warm
- **Compression**: After 7 days

### 6. Alerts
- **Purpose**: Anomaly and threshold alerts
- **Key Fields**: `device_id`, `alert_type`, `severity`, `status`, `triggered_at`
- **Indexes**: `status`, `severity`, `triggered_at`, `device_id`

### 7. Audit Log (Hypertable)
- **Purpose**: Immutable change log
- **Key Fields**: `table_name`, `operation`, `record_id`, `old_values`, `new_values`
- **Partitioning**: 1 month chunks
- **Retention**: 7 years (compliance)

## Indexing Strategy

### Primary Indexes
- All tables: UUID primary key (clustered)

### Time-Series Indexes
- `(device_id, recorded_at DESC)` - Device history queries
- `(inmate_device_id, recorded_at DESC)` - Inmate tracking
- `recorded_at DESC` - Recent data access

### Filtering Indexes
- Status columns: Partial indexes on active/open records
- Foreign keys: All foreign keys indexed
- JSONB: GIN indexes on JSONB columns

### Specialized Indexes
- Date ranges: GIST indexes for assignment date ranges
- Spatial: GIST indexes for location queries (if PostGIS enabled)

## Retention Policies

| Table | Hot Data | Warm Data | Archive | Delete |
|-------|----------|-----------|---------|--------|
| `vital_metrics` | 90 days | 1 year | 7 years | Never |
| `location_metrics` | 90 days | 1 year | 7 years | Never |
| `device_status` | 30 days | 6 months | 2 years | After archive |
| `gateway_status` | 30 days | 6 months | 2 years | After archive |
| `alerts` | N/A | N/A | 7 years | Never |
| `tamper_events` | N/A | N/A | 7 years | Never |
| `audit_log` | N/A | N/A | 7 years | Never |

## Compression Policies

- **vital_metrics**: Compress after 7 days
- **location_metrics**: Compress after 7 days
- **device_status**: Compress after 1 day
- **gateway_status**: Compress after 1 day

## Common Queries

### Recent Vitals for Device
```sql
SELECT * FROM vital_metrics
WHERE device_id = '...'
    AND recorded_at >= NOW() - INTERVAL '24 hours'
ORDER BY recorded_at DESC;
```

### Active Alerts
```sql
SELECT * FROM open_alerts_view
ORDER BY severity, triggered_at DESC;
```

### Device Assignment History
```sql
SELECT * FROM inmate_devices
WHERE device_id = '...'
ORDER BY assigned_date DESC;
```

### Inmate Current Device
```sql
SELECT * FROM active_inmate_devices
WHERE inmate_id = '...';
```

## Security Features

1. **Field-Level Encryption Ready**: Sensitive fields marked `_encrypted`
2. **Row-Level Security Ready**: RLS can be enabled on sensitive tables
3. **Immutable Audit Log**: All changes tracked in `audit_log`
4. **Foreign Key Constraints**: Data integrity enforced
5. **Check Constraints**: Data validation at database level

## Performance Features

1. **TimescaleDB Hypertables**: Automatic time-based partitioning
2. **Compression**: Automatic compression of old data (90%+ reduction)
3. **Strategic Indexing**: Optimized for common query patterns
4. **Materialized Views**: Pre-aggregated data for dashboards
5. **Connection Pooling**: PgBouncer recommended

## Setup Steps

1. Create database: `CREATE DATABASE pulsecal_secureband;`
2. Run schema: `\i database/schema.sql`
3. Set retention: `\i database/retention_policies.sql`
4. Verify: Check hypertables and policies

## Monitoring Queries

```sql
-- Check hypertable status
SELECT * FROM timescaledb_information.hypertables;

-- Check chunk status
SELECT * FROM timescaledb_information.chunks
ORDER BY range_start DESC;

-- Check table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

---

For complete schema documentation, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
