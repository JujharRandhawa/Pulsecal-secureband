-- ============================================================================
-- PulseCal SecureBand - Device Ownership and Lifecycle Control
-- ============================================================================

-- Create ENUM type for device status
CREATE TYPE secureband_status AS ENUM ('LOCKED', 'ACTIVE', 'REVOKED');

-- SecureBands table
CREATE TABLE IF NOT EXISTS securebands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uid VARCHAR(255) UNIQUE NOT NULL,
    jail_id UUID NOT NULL REFERENCES jails(id) ON DELETE RESTRICT,
    status secureband_status NOT NULL DEFAULT 'LOCKED',
    bound_at TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    firmware_version VARCHAR(50),
    public_key TEXT, -- Device public key for mutual authentication
    -- Lifecycle tracking
    added_by UUID, -- Admin user ID who added the device
    added_at TIMESTAMPTZ,
    removed_by UUID, -- Admin user ID who removed the device
    removed_at TIMESTAMPTZ,
    removal_reason TEXT,
    -- Security
    auth_token_hash TEXT, -- Hashed jail-bound authorization token
    token_issued_at TIMESTAMPTZ,
    token_expires_at TIMESTAMPTZ,
    nonce_seed TEXT, -- Seed for replay attack protection
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_securebands_device_uid ON securebands(device_uid);
CREATE INDEX idx_securebands_jail_id ON securebands(jail_id);
CREATE INDEX idx_securebands_status ON securebands(status);
CREATE INDEX idx_securebands_jail_status ON securebands(jail_id, status);
CREATE INDEX idx_securebands_last_seen ON securebands(last_seen) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX idx_securebands_device_uid_unique ON securebands(device_uid) WHERE status != 'REVOKED';

-- Function to update updated_at timestamp
CREATE TRIGGER update_securebands_updated_at BEFORE UPDATE ON securebands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to audit secureband changes
CREATE TRIGGER audit_securebands AFTER INSERT OR UPDATE OR DELETE ON securebands
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Function to prevent duplicate active registrations
CREATE OR REPLACE FUNCTION prevent_duplicate_active_device()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if device UID is already active in another jail
    IF NEW.status = 'ACTIVE' OR NEW.status = 'LOCKED' THEN
        IF EXISTS (
            SELECT 1 FROM securebands
            WHERE device_uid = NEW.device_uid
                AND id != NEW.id
                AND status IN ('ACTIVE', 'LOCKED')
        ) THEN
            RAISE EXCEPTION 'Device UID % is already registered and active in another jail', NEW.device_uid;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_duplicate_active_device_trigger
    BEFORE INSERT OR UPDATE ON securebands
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_active_device();

-- Function to generate jail-bound authorization token
CREATE OR REPLACE FUNCTION generate_device_auth_token(
    p_device_uid VARCHAR,
    p_jail_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_secret TEXT;
BEGIN
    -- Generate token: base64(device_uid:jail_id:timestamp:random)
    v_secret := current_setting('app.device_auth_secret', true);
    IF v_secret IS NULL THEN
        v_secret := 'CHANGE_ME_IN_PRODUCTION';
    END IF;
    
    v_token := encode(
        digest(
            p_device_uid || ':' || p_jail_id::TEXT || ':' || 
            EXTRACT(EPOCH FROM NOW())::TEXT || ':' || 
            gen_random_uuid()::TEXT || ':' || v_secret,
            'sha256'
        ),
        'base64'
    );
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- Function to validate device authentication
CREATE OR REPLACE FUNCTION validate_device_auth(
    p_device_uid VARCHAR,
    p_token TEXT,
    p_nonce TEXT
)
RETURNS TABLE(
    is_valid BOOLEAN,
    jail_id UUID,
    device_id UUID,
    status secureband_status
) AS $$
DECLARE
    v_device RECORD;
    v_expected_token TEXT;
BEGIN
    -- Find device
    SELECT * INTO v_device
    FROM securebands
    WHERE device_uid = p_device_uid
        AND status = 'ACTIVE';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::secureband_status;
        RETURN;
    END IF;
    
    -- Check token expiration
    IF v_device.token_expires_at < NOW() THEN
        RETURN QUERY SELECT false, v_device.jail_id, v_device.id, v_device.status;
        RETURN;
    END IF;
    
    -- Validate token (simplified - in production use proper cryptographic validation)
    -- For now, check if token hash matches
    IF v_device.auth_token_hash IS NOT NULL AND 
       v_device.auth_token_hash != encode(digest(p_token, 'sha256'), 'hex') THEN
        RETURN QUERY SELECT false, v_device.jail_id, v_device.id, v_device.status;
        RETURN;
    END IF;
    
    -- Update last seen
    UPDATE securebands
    SET last_seen = NOW()
    WHERE id = v_device.id;
    
    RETURN QUERY SELECT true, v_device.jail_id, v_device.id, v_device.status;
END;
$$ LANGUAGE plpgsql;

-- View for active devices
CREATE OR REPLACE VIEW active_securebands AS
SELECT 
    s.id,
    s.device_uid,
    s.jail_id,
    j.name AS jail_name,
    s.status,
    s.bound_at,
    s.last_seen,
    s.firmware_version,
    CASE 
        WHEN s.last_seen > NOW() - INTERVAL '5 minutes' THEN 'online'
        WHEN s.last_seen > NOW() - INTERVAL '1 hour' THEN 'recent'
        ELSE 'offline'
    END AS connection_status
FROM securebands s
JOIN jails j ON s.jail_id = j.id
WHERE s.status = 'ACTIVE'
ORDER BY s.last_seen DESC;

-- View for device lifecycle history
CREATE OR REPLACE VIEW secureband_lifecycle AS
SELECT 
    s.id,
    s.device_uid,
    s.jail_id,
    j.name AS jail_name,
    s.status,
    s.bound_at,
    s.added_at,
    s.added_by,
    s.removed_at,
    s.removed_by,
    s.removal_reason,
    s.last_seen,
    s.created_at,
    s.updated_at
FROM securebands s
JOIN jails j ON s.jail_id = j.id
ORDER BY s.created_at DESC;
