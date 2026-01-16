-- ============================================================================
-- PulseCal SecureBand - Operational Hardening
-- Tamper-resistant audit logging and forensic capabilities
-- ============================================================================

-- ============================================================================
-- Enhanced Audit Log with Tamper Resistance
-- ============================================================================

-- Create audit log table with additional security fields
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    jail_id UUID REFERENCES jails(id) ON DELETE SET NULL,
    user_id UUID, -- Admin user ID (when user system is implemented)
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    ip_address INET NOT NULL,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    request_body JSONB,
    response_status INTEGER,
    old_values JSONB,
    new_values JSONB,
    reason TEXT, -- Justification for action
    approval_required BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    -- Tamper resistance fields
    hash_chain TEXT, -- Cryptographic hash chain
    previous_hash TEXT, -- Hash of previous entry
    signature TEXT, -- Digital signature (if using PKI)
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
    -- Forensic fields
    session_id UUID,
    correlation_id UUID, -- For tracking related actions
    metadata JSONB
);

-- Convert to TimescaleDB hypertable for efficient time-series storage
SELECT create_hypertable('admin_audit_log', 'timestamp',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_admin_audit_jail ON admin_audit_log(jail_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON admin_audit_log(resource_type, resource_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_timestamp ON admin_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_severity ON admin_audit_log(severity, timestamp DESC) WHERE severity IN ('warning', 'critical');
CREATE INDEX IF NOT EXISTS idx_admin_audit_hash ON admin_audit_log(previous_hash) WHERE previous_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_audit_correlation ON admin_audit_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- Function to calculate hash chain (tamper resistance)
CREATE OR REPLACE FUNCTION calculate_audit_hash(
    p_previous_hash TEXT,
    p_entry_data TEXT
)
RETURNS TEXT AS $$
BEGIN
    -- Use SHA-256 for hash chain
    -- In production, use a more secure method with salt
    RETURN encode(digest(COALESCE(p_previous_hash, '') || p_entry_data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get previous hash for hash chain
CREATE OR REPLACE FUNCTION get_previous_audit_hash()
RETURNS TEXT AS $$
DECLARE
    v_hash TEXT;
BEGIN
    SELECT hash_chain INTO v_hash
    FROM admin_audit_log
    ORDER BY timestamp DESC
    LIMIT 1;
    
    RETURN v_hash;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate hash chain on insert
CREATE OR REPLACE FUNCTION audit_hash_chain_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_hash TEXT;
    v_entry_data TEXT;
    v_new_hash TEXT;
BEGIN
    -- Get previous hash
    v_previous_hash := get_previous_audit_hash();
    
    -- Create entry data string (all fields that should be protected)
    v_entry_data := format(
        '%s|%s|%s|%s|%s|%s|%s|%s',
        NEW.id,
        NEW.timestamp,
        COALESCE(NEW.jail_id::TEXT, ''),
        COALESCE(NEW.user_id::TEXT, ''),
        NEW.action,
        NEW.resource_type,
        COALESCE(NEW.resource_id::TEXT, ''),
        COALESCE(NEW.new_values::TEXT, '')
    );
    
    -- Calculate new hash
    v_new_hash := calculate_audit_hash(v_previous_hash, v_entry_data);
    
    -- Set hash fields
    NEW.previous_hash := v_previous_hash;
    NEW.hash_chain := v_new_hash;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_hash_chain_trigger
    BEFORE INSERT ON admin_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION audit_hash_chain_trigger();

-- Function to verify audit log integrity
CREATE OR REPLACE FUNCTION verify_audit_integrity(
    p_start_time TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
    entry_id UUID,
    timestamp TIMESTAMPTZ,
    is_valid BOOLEAN,
    expected_hash TEXT,
    actual_hash TEXT,
    previous_entry_id UUID
) AS $$
DECLARE
    v_prev_hash TEXT := NULL;
    v_prev_id UUID := NULL;
BEGIN
    FOR entry_id, timestamp, hash_chain, prev_hash IN
        SELECT id, timestamp, hash_chain, previous_hash
        FROM admin_audit_log
        WHERE timestamp BETWEEN p_start_time AND p_end_time
        ORDER BY timestamp ASC
    LOOP
        -- Calculate expected hash
        DECLARE
            v_entry_data TEXT;
            v_expected_hash TEXT;
        BEGIN
            v_entry_data := format(
                '%s|%s|%s|%s|%s|%s|%s|%s',
                entry_id,
                timestamp,
                COALESCE((SELECT jail_id::TEXT FROM admin_audit_log WHERE id = entry_id), ''),
                COALESCE((SELECT user_id::TEXT FROM admin_audit_log WHERE id = entry_id), ''),
                (SELECT action FROM admin_audit_log WHERE id = entry_id),
                (SELECT resource_type FROM admin_audit_log WHERE id = entry_id),
                COALESCE((SELECT resource_id::TEXT FROM admin_audit_log WHERE id = entry_id), ''),
                COALESCE((SELECT new_values::TEXT FROM admin_audit_log WHERE id = entry_id), '')
            );
            
            v_expected_hash := calculate_audit_hash(v_prev_hash, v_entry_data);
            
            RETURN QUERY SELECT
                entry_id,
                timestamp,
                (hash_chain = v_expected_hash) AS is_valid,
                v_expected_hash AS expected_hash,
                hash_chain AS actual_hash,
                v_prev_id AS previous_entry_id;
            
            v_prev_hash := hash_chain;
            v_prev_id := entry_id;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Forensic Mode Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS forensic_mode (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN NOT NULL DEFAULT false,
    enabled_at TIMESTAMPTZ,
    enabled_by UUID, -- Admin user ID
    enabled_reason TEXT NOT NULL,
    disabled_at TIMESTAMPTZ,
    disabled_by UUID,
    disabled_reason TEXT,
    read_only BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active forensic mode session
CREATE UNIQUE INDEX idx_forensic_mode_active ON forensic_mode(enabled) WHERE enabled = true;

-- Function to enable forensic mode
CREATE OR REPLACE FUNCTION enable_forensic_mode(
    p_enabled_by UUID,
    p_reason TEXT,
    p_read_only BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Disable any existing forensic mode
    UPDATE forensic_mode
    SET enabled = false,
        disabled_at = NOW(),
        disabled_by = p_enabled_by,
        disabled_reason = 'Replaced by new forensic mode session'
    WHERE enabled = true;
    
    -- Create new forensic mode session
    INSERT INTO forensic_mode (enabled, enabled_at, enabled_by, enabled_reason, read_only)
    VALUES (true, NOW(), p_enabled_by, p_reason, p_read_only)
    RETURNING id INTO v_id;
    
    -- Log the action
    INSERT INTO admin_audit_log (
        action, resource_type, resource_id, ip_address,
        new_values, severity, reason
    )
    VALUES (
        'forensic_mode_enabled',
        'system',
        v_id,
        '127.0.0.1', -- System action
        jsonb_build_object('read_only', p_read_only, 'reason', p_reason),
        'critical',
        p_reason
    );
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to disable forensic mode
CREATE OR REPLACE FUNCTION disable_forensic_mode(
    p_disabled_by UUID,
    p_reason TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE forensic_mode
    SET enabled = false,
        disabled_at = NOW(),
        disabled_by = p_disabled_by,
        disabled_reason = p_reason
    WHERE enabled = true;
    
    -- Log the action
    INSERT INTO admin_audit_log (
        action, resource_type, ip_address,
        new_values, severity, reason
    )
    VALUES (
        'forensic_mode_disabled',
        'system',
        '127.0.0.1',
        jsonb_build_object('reason', p_reason),
        'critical',
        p_reason
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if forensic mode is active
CREATE OR REPLACE FUNCTION is_forensic_mode_active()
RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
BEGIN
    SELECT enabled INTO v_enabled
    FROM forensic_mode
    WHERE enabled = true
    LIMIT 1;
    
    RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Manual Override Procedures
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    override_type VARCHAR(100) NOT NULL, -- 'emergency', 'maintenance', 'recovery'
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    action VARCHAR(100) NOT NULL,
    requested_by UUID NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    justification TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, executed, rejected
    old_state JSONB,
    new_state JSONB,
    rollback_available BOOLEAN DEFAULT true,
    rollback_executed BOOLEAN DEFAULT false,
    rollback_at TIMESTAMPTZ,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_overrides_type ON manual_overrides(override_type, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_overrides_status ON manual_overrides(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_overrides_resource ON manual_overrides(resource_type, resource_id);

-- Function to create manual override request
CREATE OR REPLACE FUNCTION create_override_request(
    p_override_type VARCHAR,
    p_resource_type VARCHAR,
    p_resource_id UUID,
    p_action VARCHAR,
    p_requested_by UUID,
    p_reason TEXT,
    p_justification TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO manual_overrides (
        override_type, resource_type, resource_id, action,
        requested_by, reason, justification, metadata
    )
    VALUES (
        p_override_type, p_resource_type, p_resource_id, p_action,
        p_requested_by, p_reason, p_justification, p_metadata
    )
    RETURNING id INTO v_id;
    
    -- Log the override request
    INSERT INTO admin_audit_log (
        action, resource_type, resource_id,
        new_values, severity, reason, approval_required
    )
    VALUES (
        'override_requested',
        p_resource_type,
        p_resource_id,
        jsonb_build_object(
            'override_type', p_override_type,
            'action', p_action,
            'override_id', v_id
        ),
        'critical',
        p_reason,
        true
    );
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Read-Only Enforcement (for forensic mode)
-- ============================================================================

-- Function to check if write operations are allowed
CREATE OR REPLACE FUNCTION is_write_allowed()
RETURNS BOOLEAN AS $$
DECLARE
    v_forensic_active BOOLEAN;
    v_read_only BOOLEAN;
BEGIN
    -- Check if forensic mode is active
    SELECT enabled, read_only INTO v_forensic_active, v_read_only
    FROM forensic_mode
    WHERE enabled = true
    LIMIT 1;
    
    -- If forensic mode is active and read-only, deny writes
    IF v_forensic_active AND v_read_only THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent writes in read-only forensic mode
CREATE OR REPLACE FUNCTION prevent_writes_in_forensic_mode()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT is_write_allowed() THEN
        RAISE EXCEPTION 'Write operations are disabled in forensic mode. Current mode: read-only';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables (example - can be extended)
-- Note: These triggers should be added carefully to avoid performance impact
-- CREATE TRIGGER prevent_inmate_writes_in_forensic
--     BEFORE INSERT OR UPDATE OR DELETE ON inmates
--     FOR EACH ROW
--     EXECUTE FUNCTION prevent_writes_in_forensic_mode();

-- ============================================================================
-- Audit Log Views for Reporting
-- ============================================================================

-- View for critical admin actions
CREATE OR REPLACE VIEW critical_admin_actions AS
SELECT 
    id,
    timestamp,
    jail_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    reason,
    severity,
    correlation_id
FROM admin_audit_log
WHERE severity IN ('warning', 'critical')
    OR approval_required = true
ORDER BY timestamp DESC;

-- View for admin activity summary
CREATE OR REPLACE VIEW admin_activity_summary AS
SELECT 
    DATE_TRUNC('day', timestamp) AS date,
    action,
    COUNT(*) AS action_count,
    COUNT(DISTINCT jail_id) AS unique_jails,
    COUNT(DISTINCT ip_address) AS unique_ips
FROM admin_audit_log
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp), action
ORDER BY date DESC, action_count DESC;

-- View for forensic mode history
CREATE OR REPLACE VIEW forensic_mode_history AS
SELECT 
    id,
    enabled_at,
    enabled_by,
    enabled_reason,
    disabled_at,
    disabled_by,
    disabled_reason,
    read_only,
    disabled_at - enabled_at AS duration
FROM forensic_mode
ORDER BY enabled_at DESC;
