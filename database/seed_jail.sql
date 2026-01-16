-- ============================================================================
-- PulseCal SecureBand - Seed Initial Jail
-- This script creates an initial jail for testing/development
-- IMPORTANT: Change the password immediately after first login!
-- ============================================================================

-- Note: This uses a placeholder password hash. In production, generate a proper
-- Argon2 hash using the auth service or a password hashing tool.
-- Default password: "ChangeMe123!" (MUST be changed immediately)

-- Example Argon2 hash for "ChangeMe123!" (generated with argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4)
-- You should generate your own hash using: node -e "const argon2 = require('argon2'); argon2.hash('YourPasswordHere').then(console.log)"

INSERT INTO jails (name, password_hash, password_changed_at, is_active)
VALUES (
    'Main Jail',
    '$argon2id$v=19$m=65536,t=3,p=4$example_salt_here$example_hash_here',
    NOW(),
    true
)
ON CONFLICT (name) DO NOTHING;

-- To generate a proper hash, use the auth service or run:
-- node -e "const argon2 = require('argon2'); argon2.hash('YourSecurePassword', {type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4}).then(h => console.log(h))"
