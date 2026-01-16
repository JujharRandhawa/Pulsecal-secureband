# PulseCal SecureBand - Entity Relationship Diagram

## Visual ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FACILITIES                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                       │   │
│  │ code (UK)            │ VARCHAR(50)                                 │   │
│  │ name                 │ VARCHAR(255)                                │   │
│  │ address_encrypted   │ TEXT                                        │   │
│  │ is_active            │ BOOLEAN                                    │   │
│  │ created_at           │ TIMESTAMPTZ                                │   │
│  │ updated_at           │ TIMESTAMPTZ                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
┌─────────────────────────────▼─────────────────────────────────────────────┐
│                              ZONES                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                       │   │
│  │ facility_id (FK)     │ UUID → facilities.id                      │   │
│  │ code (UK)            │ VARCHAR(50)                                 │   │
│  │ name                 │ VARCHAR(255)                                │   │
│  │ description          │ TEXT                                        │   │
│  │ boundaries           │ JSONB                                       │   │
│  │ is_active            │ BOOLEAN                                    │   │
│  │ created_at           │ TIMESTAMPTZ                                │   │
│  │ updated_at           │ TIMESTAMPTZ                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
┌─────────────────────────────▼─────────────────────────────────────────────┐
│                            INMATES                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)                    │ UUID                               │   │
│  │ facility_id (FK)           │ UUID → facilities.id                │   │
│  │ zone_id (FK)               │ UUID → zones.id                     │   │
│  │ inmate_number (UK)         │ VARCHAR(50)                         │   │
│  │ first_name_encrypted        │ TEXT                                │   │
│  │ last_name_encrypted         │ TEXT                                │   │
│  │ date_of_birth_encrypted     │ DATE                                │   │
│  │ gender                      │ VARCHAR(10)                        │   │
│  │ medical_conditions_encrypted │ JSONB                               │   │
│  │ admission_date              │ DATE                                │   │
│  │ release_date                │ DATE                                │   │
│  │ status                      │ VARCHAR(50)                         │   │
│  │ created_at                  │ TIMESTAMPTZ                         │   │
│  │ updated_at                  │ TIMESTAMPTZ                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
┌─────────────────────────────▼─────────────────────────────────────────────┐
│                        INMATE_DEVICES                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                       │   │
│  │ inmate_id (FK)       │ UUID → inmates.id                          │   │
│  │ device_id (FK)       │ UUID → devices.id                          │   │
│  │ assigned_date        │ DATE                                       │   │
│  │ unassigned_date      │ DATE                                       │   │
│  │ assignment_reason    │ TEXT                                       │   │
│  │ status               │ VARCHAR(50)                                │   │
│  │ created_at           │ TIMESTAMPTZ                                │   │
│  │ updated_at           │ TIMESTAMPTZ                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ N:1
                              │
┌─────────────────────────────▼─────────────────────────────────────────────┐
│                            DEVICES                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                       │   │
│  │ serial_number (UK)   │ VARCHAR(100)                               │   │
│  │ mac_address (UK)     │ VARCHAR(17)                                │   │
│  │ firmware_version     │ VARCHAR(50)                                │   │
│  │ hardware_version     │ VARCHAR(50)                                │   │
│  │ manufactured_date    │ DATE                                       │   │
│  │ deployed_date        │ DATE                                       │   │
│  │ status               │ VARCHAR(50)                               │   │
│  │ last_seen_at         │ TIMESTAMPTZ                                │   │
│  │ created_at           │ TIMESTAMPTZ                                │   │
│  │ updated_at           │ TIMESTAMPTZ                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │ 1:N     │ 1:N     │ 1:N
                    │         │         │
        ┌───────────▼───┐  ┌──▼────┐  ┌─▼──────────────┐
        │ VITAL_METRICS │  │ ALERTS│  │ TAMPER_EVENTS  │
        │ (Hypertable)   │  │       │  │                │
        └───────────────┘  └───────┘  └────────────────┘
                    │
                    │ 1:N
                    │
        ┌───────────▼───────────┐
        │ LOCATION_METRICS      │
        │ (Hypertable)          │
        └───────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          GATEWAYS                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                       │   │
│  │ facility_id (FK)     │ UUID → facilities.id                      │   │
│  │ serial_number (UK)   │ VARCHAR(100)                              │   │
│  │ mac_address (UK)      │ VARCHAR(17)                               │   │
│  │ firmware_version      │ VARCHAR(50)                               │   │
│  │ location              │ JSONB                                     │   │
│  │ is_active             │ BOOLEAN                                  │   │
│  │ last_seen_at          │ TIMESTAMPTZ                               │   │
│  │ created_at            │ TIMESTAMPTZ                               │   │
│  │ updated_at            │ TIMESTAMPTZ                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
        ┌─────────────────────▼─────────────────────┐
        │         GATEWAY_STATUS                     │
        │         (Hypertable)                       │
        └────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            ALERTS                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                     │   │
│  │ inmate_device_id (FK) │ UUID → inmate_devices.id                 │   │
│  │ device_id (FK)       │ UUID → devices.id                        │   │
│  │ alert_type           │ VARCHAR(100)                             │   │
│  │ severity             │ VARCHAR(20)                               │   │
│  │ status               │ VARCHAR(50)                              │   │
│  │ description          │ TEXT                                     │   │
│  │ alert_data           │ JSONB                                    │   │
│  │ triggered_at         │ TIMESTAMPTZ                              │   │
│  │ acknowledged_at      │ TIMESTAMPTZ                              │   │
│  │ acknowledged_by      │ UUID                                     │   │
│  │ resolved_at          │ TIMESTAMPTZ                              │   │
│  │ resolved_by          │ UUID                                     │   │
│  │ resolution_notes     │ TEXT                                     │   │
│  │ created_at           │ TIMESTAMPTZ                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
        ┌─────────────────────▼─────────────────────┐
        │         ALERT_HISTORY                       │
        │         (Immutable)                        │
        └────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIT_LOG                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ id (PK)              │ UUID                                       │   │
│  │ table_name           │ VARCHAR(100)                               │   │
│  │ operation            │ VARCHAR(20)                                │   │
│  │ record_id            │ UUID                                       │   │
│  │ user_id              │ UUID                                       │   │
│  │ old_values           │ JSONB                                      │   │
│  │ new_values           │ JSONB                                      │   │
│  │ ip_address           │ INET                                       │   │
│  │ user_agent           │ TEXT                                       │   │
│  │ created_at           │ TIMESTAMPTZ                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  (Hypertable - 1 month chunks)                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Relationship Summary

| Parent Table | Relationship | Child Table | Notes |
|--------------|-------------|-------------|-------|
| `facilities` | 1:N | `zones` | One facility has many zones |
| `facilities` | 1:N | `gateways` | One facility has many gateways |
| `facilities` | 1:N | `inmates` | One facility houses many inmates |
| `zones` | 1:N | `inmates` | One zone contains many inmates |
| `inmates` | 1:N | `inmate_devices` | One inmate can have multiple device assignments (over time) |
| `devices` | 1:N | `inmate_devices` | One device can be assigned to multiple inmates (over time) |
| `devices` | 1:N | `vital_metrics` | One device generates many vital readings |
| `devices` | 1:N | `location_metrics` | One device generates many location readings |
| `devices` | 1:N | `device_status` | One device has many status updates |
| `devices` | 1:N | `alerts` | One device can trigger many alerts |
| `devices` | 1:N | `tamper_events` | One device can have many tamper events |
| `inmate_devices` | 1:N | `vital_metrics` | One assignment produces many metrics |
| `inmate_devices` | 1:N | `location_metrics` | One assignment produces many locations |
| `inmate_devices` | 1:N | `alerts` | One assignment can trigger many alerts |
| `gateways` | 1:N | `device_status` | One gateway reports status for many devices |
| `gateways` | 1:N | `gateway_status` | One gateway has many status updates |
| `alerts` | 1:N | `alert_history` | One alert has many history entries |

## Time-Series Tables (Hypertables)

These tables use TimescaleDB hypertables for efficient time-series storage:

1. **vital_metrics** - Partitioned by `recorded_at` (1 day chunks)
2. **location_metrics** - Partitioned by `recorded_at` (1 day chunks)
3. **device_status** - Partitioned by `recorded_at` (1 day chunks)
4. **gateway_status** - Partitioned by `recorded_at` (1 day chunks)
5. **audit_log** - Partitioned by `created_at` (1 month chunks)

## Key Constraints

### Unique Constraints
- `facilities.code`
- `zones(facility_id, code)` - Composite unique
- `gateways.serial_number`
- `gateways.mac_address`
- `devices.serial_number`
- `devices.mac_address`
- `inmates.inmate_number`

### Exclusion Constraints
- `inmate_devices`: Prevents overlapping device assignments (using GIST index on date range)

### Check Constraints
- `vital_metrics.heart_rate`: 0-250
- `vital_metrics.temperature_celsius`: 30.0-45.0
- `vital_metrics.oxygen_saturation`: 0-100
- `vital_metrics.battery_level`: 0-100
- `device_status.battery_level`: 0-100

## Data Flow

```
Wearable Device
    │
    │ BLE
    ▼
Gateway (aggregates)
    │
    │ HTTPS
    ▼
Backend API
    │
    ├─► Devices Table (metadata)
    ├─► Vital Metrics (hypertable)
    ├─► Location Metrics (hypertable)
    ├─► Device Status (hypertable)
    └─► Alerts (if anomaly detected)
        │
        └─► Alert History (immutable)
```

## Security Considerations

1. **Encrypted Fields**: Fields marked `_encrypted` should be encrypted at application level
2. **Audit Trail**: All changes to critical tables logged in `audit_log`
3. **Row-Level Security**: Can be enabled on `inmates`, `inmate_devices`, `alerts`
4. **Foreign Key Constraints**: Ensure referential integrity
5. **Immutable Logs**: `audit_log` and `alert_history` are append-only

---

For complete schema details, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
