-- ============================================================================
-- PulseCal SecureBand - Retention and Compression Policies
-- ============================================================================

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

-- ============================================================================
-- COMPRESSION POLICIES
-- ============================================================================

-- Compress data older than 7 days for vital_metrics
SELECT add_compression_policy('vital_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Compress data older than 7 days for location_metrics
SELECT add_compression_policy('location_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Compress data older than 1 day for device_status
SELECT add_compression_policy('device_status', INTERVAL '1 day', if_not_exists => TRUE);

-- Compress data older than 1 day for gateway_status
SELECT add_compression_policy('gateway_status', INTERVAL '1 day', if_not_exists => TRUE);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check retention policies
SELECT 
    hypertable_name,
    config->>'retention_period' AS retention_period,
    scheduled
FROM timescaledb_information.jobs
WHERE proc_name LIKE '%retention%'
ORDER BY hypertable_name;

-- Check compression policies
SELECT 
    hypertable_name,
    config->>'compress_after' AS compress_after,
    scheduled
FROM timescaledb_information.jobs
WHERE proc_name LIKE '%compression%'
ORDER BY hypertable_name;
