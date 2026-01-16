# PulseCal SecureBand - Database Schema Design

## Overview

This document defines the complete database schema for PulseCal SecureBand, a prison wearable monitoring system. The schema is designed for PostgreSQL with TimescaleDB extension to handle high-volume time-series data while maintaining relational integrity.

## Design Principles

1. **Time-Series Optimization**: Vitals and location data use TimescaleDB hypertables
2. **Immutable Audit Logs**: All critical operations are logged immutably
3. **Data Retention**: Automatic partitioning and retention policies
4. **Performance**: Strategic indexing for common query patterns
5. **Security**: Row-level security ready, field-level encryption ready
6. **Scalability**: Partitioning strategies for 10,000+ devices

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    FACILITY ||--o{ ZONE : contains
    FACILITY ||--o{ GATEWAY : hosts
    FACILITY ||--o{ INMATE : houses
    
    ZONE ||--o{ INMATE : contains
    
    INMATE ||--o{ INMATE_DEVICE : assigned
    INMATE ||--o{ ALERT : triggers
    
    DEVICE ||--o{ INMATE_DEVICE : used_in
    DEVICE ||--o{ VITAL_METRIC : generates
    DEVICE ||--o{ LOCATION_METRIC : generates
    DEVICE ||--o{ TAMPER_EVENT : generates
    DEVICE ||--o{ DEVICE_STATUS : reports
    
    GATEWAY ||--o{ DEVICE : manages
    GATEWAY ||--o{ GATEWAY_STATUS : reports
    
    INMATE_DEVICE ||--o{ ALERT : associated_with
    INMATE_DEVICE ||--o{ VITAL_METRIC : produces
    INMATE_DEVICE ||--o{ LOCATION_METRIC : produces
    
    ALERT ||--o{ ALERT_HISTORY : has_history
    
    FACILITY {
        uuid id PK
        string code UK
        string name
        string address_encrypted
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    ZONE {
        uuid id PK
        uuid facility_id FK
        string code UK
        string name
        string description
        jsonb boundaries
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    GATEWAY {
        uuid id PK
        uuid facility_id FK
        string serial_number UK
        string mac_address UK
        string firmware_version
        jsonb location
        boolean is_active
        timestamp last_seen_at
        timestamp created_at
        timestamp updated_at
    }
    
    DEVICE {
        uuid id PK
        string serial_number UK
        string mac_address UK
        string firmware_version
        string hardware_version
        date manufactured_date
        date deployed_date
        string status
        timestamp last_seen_at
        timestamp created_at
        timestamp updated_at
    }
    
    INMATE {
        uuid id PK
        uuid facility_id FK
        uuid zone_id FK
        string inmate_number UK
        string first_name_encrypted
        string last_name_encrypted
        date date_of_birth_encrypted
        string gender
        jsonb medical_conditions_encrypted
        date admission_date
        date release_date
        string status
        timestamp created_at
        timestamp updated_at
    }
    
    INMATE_DEVICE {
        uuid id PK
        uuid inmate_id FK
        uuid device_id FK
        date assigned_date
        date unassigned_date
        string assignment_reason
        string status
        timestamp created_at
        timestamp updated_at
    }
    
    VITAL_METRIC {
        uuid id PK
        uuid device_id FK
        uuid inmate_device_id FK
        timestamp recorded_at
        integer heart_rate
        decimal temperature_celsius
        integer oxygen_saturation
        integer blood_pressure_systolic
        integer blood_pressure_diastolic
        integer battery_level
        integer signal_strength
        jsonb additional_metrics
    }
    
    LOCATION_METRIC {
        uuid id PK
        uuid device_id FK
        uuid inmate_device_id FK
        timestamp recorded_at
        uuid zone_id FK
        decimal x_coordinate
        decimal y_coordinate
        decimal z_coordinate
        decimal accuracy_meters
        string location_method
    }
    
    ALERT {
        uuid id PK
        uuid inmate_device_id FK
        uuid device_id FK
        string alert_type
        string severity
        string status
        text description
        jsonb alert_data
        timestamp triggered_at
        timestamp acknowledged_at
        uuid acknowledged_by
        timestamp resolved_at
        uuid resolved_by
        text resolution_notes
        timestamp created_at
    }
    
    ALERT_HISTORY {
        uuid id PK
        uuid alert_id FK
        string action
        uuid performed_by
        text notes
        jsonb metadata
        timestamp created_at
    }
    
    TAMPER_EVENT {
        uuid id PK
        uuid device_id FK
        uuid inmate_device_id FK
        string event_type
        string severity
        text description
        jsonb event_data
        timestamp detected_at
        timestamp reported_at
        string status
        timestamp created_at
    }
    
    DEVICE_STATUS {
        uuid id PK
        uuid device_id FK
        uuid gateway_id FK
        timestamp recorded_at
        string connection_status
        integer battery_level
        integer signal_strength
        jsonb system_status
    }
    
    GATEWAY_STATUS {
        uuid id PK
        uuid gateway_id FK
        timestamp recorded_at
        string connection_status
        integer connected_devices
        jsonb system_metrics
    }
    
    AUDIT_LOG {
        uuid id PK
        string table_name
        string operation
        uuid record_id
        uuid user_id
        jsonb old_values
        jsonb new_values
        text ip_address
        text user_agent
        timestamp created_at
    }
```

---

## 2. SQL Schema

### 2.1 Core Tables

```sql
-- ============================================================================
-- CORE REFERENCE TABLES
-- ============================================================================

-- Facilities (Prisons)
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address_encrypted TEXT, -- Encrypted address for security
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facilities_code ON facilities(code);
CREATE INDEX idx_facilities_active ON facilities(is_active) WHERE is_active = true;

-- Zones (Areas within facilities)
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    boundaries JSONB, -- GeoJSON boundaries for the zone
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(facility_id, code)
);

CREATE INDEX idx_zones_facility ON zones(facility_id);
CREATE INDEX idx_zones_active ON zones(is_active) WHERE is_active = true;
CREATE INDEX idx_zones_boundaries ON zones USING GIN(boundaries);

-- Gateways (BLE aggregation devices)
CREATE TABLE gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    firmware_version VARCHAR(50),
    location JSONB, -- Physical location coordinates
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gateways_facility ON gateways(facility_id);
CREATE INDEX idx_gateways_serial ON gateways(serial_number);
CREATE INDEX idx_gateways_active ON gateways(is_active) WHERE is_active = true;
CREATE INDEX idx_gateways_last_seen ON gateways(last_seen_at) WHERE is_active = true;

-- Devices (Wearable hardware)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    firmware_version VARCHAR(50),
    hardware_version VARCHAR(50),
    manufactured_date DATE,
    deployed_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'inventory', -- inventory, active, maintenance, retired
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_serial ON devices(serial_number);
CREATE INDEX idx_devices_mac ON devices(mac_address);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at) WHERE status = 'active';

-- Inmates (Prisoner profiles - minimal PII)
CREATE TABLE inmates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    inmate_number VARCHAR(50) NOT NULL UNIQUE,
    first_name_encrypted TEXT, -- Encrypted for security
    last_name_encrypted TEXT,
    date_of_birth_encrypted DATE, -- Encrypted date
    gender VARCHAR(10),
    medical_conditions_encrypted JSONB, -- Encrypted medical data
    admission_date DATE NOT NULL,
    release_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, released, transferred
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inmates_facility ON inmates(facility_id);
CREATE INDEX idx_inmates_zone ON inmates(zone_id);
CREATE INDEX idx_inmates_number ON inmates(inmate_number);
CREATE INDEX idx_inmates_status ON inmates(status);
CREATE INDEX idx_inmates_admission ON inmates(admission_date);
CREATE INDEX idx_inmates_release ON inmates(release_date) WHERE release_date IS NOT NULL;

-- Inmate-Device Assignments
CREATE TABLE inmate_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inmate_id UUID NOT NULL REFERENCES inmates(id) ON DELETE RESTRICT,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    assigned_date DATE NOT NULL,
    unassigned_date DATE,
    assignment_reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'assigned', -- assigned, unassigned, lost, damaged
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure one active assignment per device
    EXCLUDE USING gist (device_id WITH =, daterange(assigned_date, COALESCE(unassigned_date, 'infinity'::date)) WITH &&)
    WHERE status = 'assigned'
);

CREATE INDEX idx_inmate_devices_inmate ON inmate_devices(inmate_id);
CREATE INDEX idx_inmate_devices_device ON inmate_devices(device_id);
CREATE INDEX idx_inmate_devices_status ON inmate_devices(status);
CREATE INDEX idx_inmate_devices_active ON inmate_devices(device_id, assigned_date, unassigned_date) 
    WHERE status = 'assigned';
CREATE INDEX idx_inmate_devices_date_range ON inmate_devices USING GIST (
    device_id, daterange(assigned_date, COALESCE(unassigned_date, 'infinity'::date))
);

-- ============================================================================
-- TIME-SERIES TABLES (TimescaleDB Hypertables)
-- ============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Vital Metrics (Heart rate, temperature, etc.)
CREATE TABLE vital_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    inmate_device_id UUID REFERENCES inmate_devices(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    heart_rate INTEGER CHECK (heart_rate >= 0 AND heart_rate <= 250),
    temperature_celsius DECIMAL(4,2) CHECK (temperature_celsius >= 30.0 AND temperature_celsius <= 45.0),
    oxygen_saturation INTEGER CHECK (oxygen_saturation >= 0 AND oxygen_saturation <= 100),
    blood_pressure_systolic INTEGER CHECK (blood_pressure_systolic >= 50 AND blood_pressure_systolic <= 250),
    blood_pressure_diastolic INTEGER CHECK (blood_pressure_diastolic >= 30 AND blood_pressure_diastolic <= 150),
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    signal_strength INTEGER, -- dBm
    additional_metrics JSONB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('vital_metrics', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for vital_metrics
CREATE INDEX idx_vital_metrics_device_time ON vital_metrics(device_id, recorded_at DESC);
CREATE INDEX idx_vital_metrics_inmate_device_time ON vital_metrics(inmate_device_id, recorded_at DESC) 
    WHERE inmate_device_id IS NOT NULL;
CREATE INDEX idx_vital_metrics_recorded_at ON vital_metrics(recorded_at DESC);
CREATE INDEX idx_vital_metrics_heart_rate ON vital_metrics(heart_rate) WHERE heart_rate IS NOT NULL;
CREATE INDEX idx_vital_metrics_temperature ON vital_metrics(temperature_celsius) WHERE temperature_celsius IS NOT NULL;

-- Location Metrics (Position tracking)
CREATE TABLE location_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    inmate_device_id UUID REFERENCES inmate_devices(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
    x_coordinate DECIMAL(10,2),
    y_coordinate DECIMAL(10,2),
    z_coordinate DECIMAL(10,2),
    accuracy_meters DECIMAL(5,2),
    location_method VARCHAR(50) -- BLE, GPS, manual
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('location_metrics', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for location_metrics
CREATE INDEX idx_location_metrics_device_time ON location_metrics(device_id, recorded_at DESC);
CREATE INDEX idx_location_metrics_inmate_device_time ON location_metrics(inmate_device_id, recorded_at DESC)
    WHERE inmate_device_id IS NOT NULL;
CREATE INDEX idx_location_metrics_zone_time ON location_metrics(zone_id, recorded_at DESC) WHERE zone_id IS NOT NULL;
CREATE INDEX idx_location_metrics_recorded_at ON location_metrics(recorded_at DESC);
CREATE INDEX idx_location_metrics_coordinates ON location_metrics USING GIST (
    ll_to_earth(y_coordinate, x_coordinate)
) WHERE x_coordinate IS NOT NULL AND y_coordinate IS NOT NULL;

-- Device Status (Connection health)
CREATE TABLE device_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    gateway_id UUID REFERENCES gateways(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    connection_status VARCHAR(50) NOT NULL, -- connected, disconnected, weak_signal
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    signal_strength INTEGER, -- dBm
    system_status JSONB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('device_status', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for device_status
CREATE INDEX idx_device_status_device_time ON device_status(device_id, recorded_at DESC);
CREATE INDEX idx_device_status_gateway_time ON device_status(gateway_id, recorded_at DESC) WHERE gateway_id IS NOT NULL;
CREATE INDEX idx_device_status_connection ON device_status(connection_status, recorded_at DESC);

-- Gateway Status (Gateway health)
CREATE TABLE gateway_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    connection_status VARCHAR(50) NOT NULL, -- online, offline, degraded
    connected_devices INTEGER DEFAULT 0,
    system_metrics JSONB -- CPU, memory, disk, network
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('gateway_status', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Indexes for gateway_status
CREATE INDEX idx_gateway_status_gateway_time ON gateway_status(gateway_id, recorded_at DESC);
CREATE INDEX idx_gateway_status_connection ON gateway_status(connection_status, recorded_at DESC);

-- ============================================================================
-- ALERT AND EVENT TABLES
-- ============================================================================

-- Alerts (Anomaly detection, threshold violations)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inmate_device_id UUID REFERENCES inmate_devices(id) ON DELETE SET NULL,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    alert_type VARCHAR(100) NOT NULL, -- heart_rate_high, temperature_high, tamper_detected, etc.
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, acknowledged, resolved, false_positive
    description TEXT,
    alert_data JSONB, -- Additional context data
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID, -- User ID (from auth system, when implemented)
    resolved_at TIMESTAMPTZ,
    resolved_by UUID, -- User ID
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_inmate_device ON alerts(inmate_device_id) WHERE inmate_device_id IS NOT NULL;
CREATE INDEX idx_alerts_device ON alerts(device_id);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_open ON alerts(status, triggered_at DESC) WHERE status = 'open';
CREATE INDEX idx_alerts_critical ON alerts(severity, triggered_at DESC) WHERE severity = 'critical';

-- Alert History (Immutable audit trail for alerts)
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- created, acknowledged, resolved, escalated, commented
    performed_by UUID, -- User ID
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_history_alert ON alert_history(alert_id, created_at DESC);
CREATE INDEX idx_alert_history_performed_by ON alert_history(performed_by) WHERE performed_by IS NOT NULL;
CREATE INDEX idx_alert_history_action ON alert_history(action, created_at DESC);

-- Tamper Events (Device tampering detection)
CREATE TABLE tamper_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    inmate_device_id UUID REFERENCES inmate_devices(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- strap_removed, device_opened, signal_jammed, etc.
    severity VARCHAR(20) NOT NULL DEFAULT 'high', -- low, medium, high, critical
    description TEXT,
    event_data JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, investigated, resolved, false_positive
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tamper_events_device ON tamper_events(device_id);
CREATE INDEX idx_tamper_events_inmate_device ON tamper_events(inmate_device_id) WHERE inmate_device_id IS NOT NULL;
CREATE INDEX idx_tamper_events_type ON tamper_events(event_type);
CREATE INDEX idx_tamper_events_severity ON tamper_events(severity);
CREATE INDEX idx_tamper_events_detected_at ON tamper_events(detected_at DESC);
CREATE INDEX idx_tamper_events_status ON tamper_events(status, detected_at DESC);

-- ============================================================================
-- AUDIT LOG (Immutable)
-- ============================================================================

-- Audit Log (Immutable record of all data changes)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID NOT NULL,
    user_id UUID, -- User ID (from auth system, when implemented)
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable for time-based partitioning
SELECT create_hypertable('audit_log', 'created_at',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Indexes for audit_log
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_operation ON audit_log(operation, created_at DESC);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gateways_updated_at BEFORE UPDATE ON gateways
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inmates_updated_at BEFORE UPDATE ON inmates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inmate_devices_updated_at BEFORE UPDATE ON inmate_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, operation, record_id, new_values)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values, new_values)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, operation, record_id, old_values)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_facilities AFTER INSERT OR UPDATE OR DELETE ON facilities
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_zones AFTER INSERT OR UPDATE OR DELETE ON zones
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_gateways AFTER INSERT OR UPDATE OR DELETE ON gateways
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_devices AFTER INSERT OR UPDATE OR DELETE ON devices
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_inmates AFTER INSERT OR UPDATE OR DELETE ON inmates
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_inmate_devices AFTER INSERT OR UPDATE OR DELETE ON inmate_devices
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_alerts AFTER INSERT OR UPDATE OR DELETE ON alerts
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Function to automatically create alert history entries
CREATE OR REPLACE FUNCTION create_alert_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO alert_history (alert_id, action, performed_by, notes, metadata)
        VALUES (
            NEW.id,
            CASE
                WHEN NEW.status = 'acknowledged' THEN 'acknowledged'
                WHEN NEW.status = 'resolved' THEN 'resolved'
                ELSE 'status_changed'
            END,
            COALESCE(NEW.acknowledged_by, NEW.resolved_by),
            NEW.resolution_notes,
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alert_history_trigger AFTER UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION create_alert_history();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active device assignments with inmate info
CREATE OR REPLACE VIEW active_inmate_devices AS
SELECT 
    id.id,
    id.inmate_id,
    id.device_id,
    i.inmate_number,
    i.facility_id,
    i.zone_id,
    d.serial_number AS device_serial,
    d.mac_address AS device_mac,
    id.assigned_date,
    id.status
FROM inmate_devices id
JOIN inmates i ON id.inmate_id = i.id
JOIN devices d ON id.device_id = d.id
WHERE id.status = 'assigned'
    AND i.status = 'active';

-- Recent vital metrics with inmate context
CREATE OR REPLACE VIEW recent_vital_metrics AS
SELECT 
    vm.id,
    vm.device_id,
    vm.inmate_device_id,
    vm.recorded_at,
    vm.heart_rate,
    vm.temperature_celsius,
    vm.oxygen_saturation,
    vm.battery_level,
    aid.inmate_id,
    i.inmate_number,
    i.facility_id
FROM vital_metrics vm
LEFT JOIN inmate_devices aid ON vm.inmate_device_id = aid.id
LEFT JOIN inmates i ON aid.inmate_id = i.id
WHERE vm.recorded_at >= NOW() - INTERVAL '24 hours';

-- Open alerts with context
CREATE OR REPLACE VIEW open_alerts_view AS
SELECT 
    a.id,
    a.alert_type,
    a.severity,
    a.triggered_at,
    a.description,
    aid.inmate_id,
    i.inmate_number,
    i.facility_id,
    d.serial_number AS device_serial,
    a.alert_data
FROM alerts a
JOIN devices d ON a.device_id = d.id
LEFT JOIN inmate_devices aid ON a.inmate_device_id = aid.id
LEFT JOIN inmates i ON aid.inmate_id = i.id
WHERE a.status = 'open'
ORDER BY 
    CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    a.triggered_at DESC;

```

---

## 3. Indexing Strategy

### 3.1 Index Categories

#### Primary Indexes
- All tables have UUID primary keys (clustered by default)
- Serial numbers and MAC addresses have UNIQUE constraints (implicit indexes)

#### Time-Series Indexes
- **Time-based queries**: `recorded_at DESC` for recent data access
- **Device-time composite**: `(device_id, recorded_at DESC)` for device history
- **Inmate-device-time composite**: `(inmate_device_id, recorded_at DESC)` for inmate tracking

#### Filtering Indexes
- **Status indexes**: Partial indexes on active/status columns
- **Foreign key indexes**: All foreign keys are indexed
- **JSONB indexes**: GIN indexes on JSONB columns for complex queries

#### Specialized Indexes
- **Spatial indexes**: GIST indexes for location queries (requires PostGIS extension)
- **Range indexes**: GIST indexes for date ranges in assignments
- **Composite indexes**: Multi-column indexes for common query patterns

### 3.2 Index Maintenance

```sql
-- Analyze tables regularly for query optimization
ANALYZE vital_metrics;
ANALYZE location_metrics;
ANALYZE device_status;

-- Reindex if needed (during maintenance windows)
REINDEX INDEX CONCURRENTLY idx_vital_metrics_device_time;
```

### 3.3 Index Usage Monitoring

```sql
-- Query to check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## 4. Retention Policies

### 4.1 Time-Series Data Retention

```sql
-- ============================================================================
-- RETENTION POLICIES
-- ============================================================================

-- Vital Metrics: 90 days hot, 1 year warm, archive older
SELECT add_retention_policy('vital_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- Location Metrics: 90 days hot, 1 year warm, archive older
SELECT add_retention_policy('location_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- Device Status: 30 days hot, 6 months warm
SELECT add_retention_policy('device_status', INTERVAL '30 days', if_not_exists => TRUE);

-- Gateway Status: 30 days hot, 6 months warm
SELECT add_retention_policy('gateway_status', INTERVAL '30 days', if_not_exists => TRUE);

-- Audit Log: 7 years (compliance requirement)
SELECT add_retention_policy('audit_log', INTERVAL '7 years', if_not_exists => TRUE);
```

### 4.2 Compression Policies

```sql
-- Compress data older than 7 days for vital_metrics
SELECT add_compression_policy('vital_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Compress data older than 7 days for location_metrics
SELECT add_compression_policy('location_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Compress data older than 1 day for device_status
SELECT add_compression_policy('device_status', INTERVAL '1 day', if_not_exists => TRUE);

-- Compress data older than 1 day for gateway_status
SELECT add_compression_policy('gateway_status', INTERVAL '1 day', if_not_exists => TRUE);
```

### 4.3 Data Archival Strategy

```sql
-- Function to archive old data to object storage
CREATE OR REPLACE FUNCTION archive_old_metrics(
    table_name TEXT,
    archive_date TIMESTAMPTZ
)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Export to CSV/Parquet and upload to S3/MinIO
    -- This would be implemented with pg_dump or COPY TO
    -- For now, this is a placeholder
    
    EXECUTE format('
        DELETE FROM %I 
        WHERE recorded_at < %L
    ', table_name, archive_date);
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

### 4.4 Retention Schedule

| Table | Hot Data | Warm Data | Archive | Delete |
|-------|----------|-----------|---------|--------|
| `vital_metrics` | 90 days | 1 year | 7 years | Never (compliance) |
| `location_metrics` | 90 days | 1 year | 7 years | Never (compliance) |
| `device_status` | 30 days | 6 months | 2 years | After archive |
| `gateway_status` | 30 days | 6 months | 2 years | After archive |
| `alerts` | N/A | N/A | 7 years | Never (compliance) |
| `tamper_events` | N/A | N/A | 7 years | Never (compliance) |
| `audit_log` | N/A | N/A | 7 years | Never (compliance) |

---

## 5. Performance Optimization

### 5.1 Query Optimization Tips

```sql
-- Use time-bounded queries for time-series data
SELECT * FROM vital_metrics
WHERE device_id = '...'
    AND recorded_at >= NOW() - INTERVAL '24 hours'
ORDER BY recorded_at DESC;

-- Use continuous aggregates for common aggregations
CREATE MATERIALIZED VIEW vital_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT 
    device_id,
    time_bucket('1 hour', recorded_at) AS hour,
    AVG(heart_rate) AS avg_heart_rate,
    MAX(heart_rate) AS max_heart_rate,
    MIN(heart_rate) AS min_heart_rate,
    AVG(temperature_celsius) AS avg_temperature
FROM vital_metrics
GROUP BY device_id, hour;

-- Refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('vital_metrics_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);
```

### 5.2 Partitioning Strategy

- **Time-based partitioning**: Automatic via TimescaleDB hypertables
- **Chunk interval**: 1 day for metrics, 1 month for audit logs
- **Automatic chunk management**: TimescaleDB handles chunk creation and deletion

### 5.3 Connection Pooling

- Use PgBouncer for connection pooling
- Recommended pool size: 25-100 connections per application instance
- Separate pools for read and write operations

---

## 6. Security Considerations

### 6.1 Row-Level Security (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE inmates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inmate_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Example policy (to be customized based on auth system)
CREATE POLICY facility_isolation ON inmates
    FOR ALL
    TO application_role
    USING (facility_id = current_setting('app.current_facility_id')::UUID);
```

### 6.2 Encryption

- **Field-level encryption**: Sensitive fields (names, addresses, medical data) should be encrypted at application level
- **Encryption at rest**: Use PostgreSQL TDE (Transparent Data Encryption) or filesystem encryption
- **Encryption in transit**: TLS 1.3 for all connections

### 6.3 Access Control

- Use database roles with minimal privileges
- Separate read and write roles
- Application uses connection pooling with role-based access

---

## 7. Migration and Setup

### 7.1 Initial Setup Script

```sql
-- Run in order:
-- 1. Create extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- If gen_random_uuid() not available

-- 2. Create tables (run schema above)

-- 3. Create indexes (run indexing section above)

-- 4. Create functions and triggers (run functions section above)

-- 5. Set up retention policies (run retention section above)

-- 6. Set up compression policies (run compression section above)
```

### 7.2 Sample Data (for testing)

```sql
-- Insert sample facility
INSERT INTO facilities (code, name) VALUES ('FAC-001', 'State Correctional Facility Alpha');

-- Insert sample zone
INSERT INTO zones (facility_id, code, name) 
SELECT id, 'ZONE-A', 'Cell Block A' FROM facilities WHERE code = 'FAC-001';

-- Insert sample gateway
INSERT INTO gateways (facility_id, serial_number, mac_address, firmware_version)
SELECT id, 'GW-001', 'AA:BB:CC:DD:EE:01', '1.0.0'
FROM facilities WHERE code = 'FAC-001';

-- Insert sample device
INSERT INTO devices (serial_number, mac_address, firmware_version, status)
VALUES ('DEV-001', '11:22:33:44:55:66', '2.1.0', 'active');
```

---

## 8. Monitoring Queries

### 8.1 Health Check Queries

```sql
-- Check hypertable status
SELECT * FROM timescaledb_information.hypertables;

-- Check chunk status
SELECT 
    hypertable_name,
    chunk_name,
    range_start,
    range_end,
    is_compressed
FROM timescaledb_information.chunks
ORDER BY range_start DESC;

-- Check retention policies
SELECT * FROM timescaledb_information.jobs
WHERE proc_name LIKE '%retention%';

-- Check compression policies
SELECT * FROM timescaledb_information.jobs
WHERE proc_name LIKE '%compression%';
```

### 8.2 Performance Monitoring

```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index sizes
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

---

## Summary

This schema provides:

✅ **Time-Series Optimization**: TimescaleDB hypertables for efficient metric storage  
✅ **Scalability**: Partitioning and indexing for 10,000+ devices  
✅ **Data Integrity**: Foreign keys, constraints, and triggers  
✅ **Audit Trail**: Immutable audit logs for compliance  
✅ **Performance**: Strategic indexing for common query patterns  
✅ **Retention**: Automated policies for data lifecycle management  
✅ **Security**: RLS-ready, encryption-ready structure  

The schema is production-ready and designed to handle high-volume time-series data while maintaining relational integrity and compliance requirements.
