-- ============================================================================
-- PulseCal SecureBand - Authentication Schema
-- Jail-locked authentication for on-premise deployment
-- ============================================================================

-- Jails (Authentication entities)
CREATE TABLE jails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, -- Argon2 hashed password
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jails_name ON jails(name);
CREATE INDEX idx_jails_active ON jails(is_active) WHERE is_active = true;

-- Sessions (One active session per jail)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jail_id UUID NOT NULL REFERENCES jails(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE, -- JWT or session token
    ip_address INET NOT NULL,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_jail ON sessions(jail_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE expires_at > NOW();
CREATE UNIQUE INDEX idx_sessions_jail_active ON sessions(jail_id) 
    WHERE expires_at > NOW();

-- Login Attempts (Rate limiting)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jail_name VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_jail_ip ON login_attempts(jail_name, ip_address, attempted_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_login_attempts_cleanup ON login_attempts(attempted_at);

-- Function to cleanup old login attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
    DELETE FROM login_attempts
    WHERE attempted_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit (max 5 attempts per 15 minutes per IP)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_ip_address INET,
    p_jail_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    attempt_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO attempt_count
    FROM login_attempts
    WHERE ip_address = p_ip_address
        AND jail_name = p_jail_name
        AND attempted_at > NOW() - INTERVAL '15 minutes'
        AND success = false;
    
    RETURN attempt_count < 5;
END;
$$ LANGUAGE plpgsql;

-- Function to invalidate all sessions for a jail (on password change)
CREATE OR REPLACE FUNCTION invalidate_jail_sessions(p_jail_id UUID)
RETURNS void AS $$
BEGIN
    DELETE FROM sessions
    WHERE jail_id = p_jail_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_jails_updated_at BEFORE UPDATE ON jails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to audit jail changes
CREATE TRIGGER audit_jails AFTER INSERT OR UPDATE OR DELETE ON jails
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- View for active sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.id,
    s.jail_id,
    j.name AS jail_name,
    s.token,
    s.ip_address,
    s.user_agent,
    s.expires_at,
    s.created_at,
    s.last_accessed_at
FROM sessions s
JOIN jails j ON s.jail_id = j.id
WHERE s.expires_at > NOW()
    AND j.is_active = true;

-- View for recent failed login attempts (for monitoring)
CREATE OR REPLACE VIEW recent_failed_logins AS
SELECT 
    jail_name,
    ip_address,
    COUNT(*) AS failure_count,
    MAX(attempted_at) AS last_attempt
FROM login_attempts
WHERE success = false
    AND attempted_at > NOW() - INTERVAL '1 hour'
GROUP BY jail_name, ip_address
ORDER BY failure_count DESC;
