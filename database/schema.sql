-- ============================================================================
-- PulseCal SecureBand - Database Schema
-- PostgreSQL 14+ with TimescaleDB Extension
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE REFERENCE TABLES
-- ============================================================================

-- Facilities (Prisons)
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address_encrypted TEXT,
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
    boundaries JSONB,
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
    location JSONB,
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
    status VARCHAR(50) NOT NULL DEFAULT 'inventory',
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
    first_name_encrypted TEXT,
    last_name_encrypted TEXT,
    date_of_birth_encrypted DATE,
    gender VARCHAR(10),
    medical_conditions_encrypted JSONB,
    admission_date DATE NOT NULL,
    release_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
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
    status VARCHAR(50) NOT NULL DEFAULT 'assigned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
    signal_strength INTEGER,
    additional_metrics JSONB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('vital_metrics', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

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
    location_method VARCHAR(50)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('location_metrics', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX idx_location_metrics_device_time ON location_metrics(device_id, recorded_at DESC);
CREATE INDEX idx_location_metrics_inmate_device_time ON location_metrics(inmate_device_id, recorded_at DESC)
    WHERE inmate_device_id IS NOT NULL;
CREATE INDEX idx_location_metrics_zone_time ON location_metrics(zone_id, recorded_at DESC) WHERE zone_id IS NOT NULL;
CREATE INDEX idx_location_metrics_recorded_at ON location_metrics(recorded_at DESC);

-- Device Status (Connection health)
CREATE TABLE device_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    gateway_id UUID REFERENCES gateways(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    connection_status VARCHAR(50) NOT NULL,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    signal_strength INTEGER,
    system_status JSONB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('device_status', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

CREATE INDEX idx_device_status_device_time ON device_status(device_id, recorded_at DESC);
CREATE INDEX idx_device_status_gateway_time ON device_status(gateway_id, recorded_at DESC) WHERE gateway_id IS NOT NULL;
CREATE INDEX idx_device_status_connection ON device_status(connection_status, recorded_at DESC);

-- Gateway Status (Gateway health)
CREATE TABLE gateway_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_id UUID NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    connection_status VARCHAR(50) NOT NULL,
    connected_devices INTEGER DEFAULT 0,
    system_metrics JSONB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('gateway_status', 'recorded_at',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

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
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    description TEXT,
    alert_data JSONB,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
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
    action VARCHAR(50) NOT NULL,
    performed_by UUID,
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
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'high',
    description TEXT,
    event_data JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
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
    operation VARCHAR(20) NOT NULL,
    record_id UUID NOT NULL,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('audit_log', 'created_at',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

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

-- Apply updated_at triggers
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

-- Apply audit triggers
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
