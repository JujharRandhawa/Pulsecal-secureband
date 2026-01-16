# Production Deployment Checklist

Use this checklist to ensure proper production deployment.

## Pre-Deployment

- [ ] System meets minimum requirements (8 GB RAM, 100 GB disk)
- [ ] Docker and Docker Compose installed
- [ ] Network ports available (3000, 3001, 8000, 5432, 6379)
- [ ] Firewall rules configured
- [ ] SSL certificates obtained (if using HTTPS)

## Configuration

- [ ] `.env` file created from `env.example`
- [ ] `DB_PASSWORD` set to strong password
- [ ] `SESSION_SECRET` generated with `openssl rand -base64 32`
- [ ] `NODE_ENV=production` set
- [ ] `DEBUG=false` set
- [ ] `DB_SYNCHRONIZE=false` set
- [ ] `DB_LOGGING=false` set
- [ ] `TRACING_ENABLED=false` set
- [ ] `CORS_ORIGIN` set to correct dashboard URL
- [ ] Alert thresholds configured (if custom)
- [ ] `LOGIN_ALLOWED_IPS` configured (if using IP restrictions)

## Security

- [ ] Strong database password set
- [ ] Session secret generated and secure
- [ ] Default passwords changed
- [ ] IP restrictions configured (if needed)
- [ ] Firewall rules in place
- [ ] SSL/TLS configured (if using HTTPS)
- [ ] Backup encryption configured (if needed)

## Deployment

- [ ] Directories created (`backups/`, `logs/`, `database/init/`)
- [ ] Docker images built successfully
- [ ] Services started successfully
- [ ] All services show "healthy" status
- [ ] Health check script passes
- [ ] Dashboard accessible
- [ ] API endpoints responding
- [ ] AI services responding

## Post-Deployment

- [ ] Automated backups configured
- [ ] Backup script tested
- [ ] Restore procedure tested
- [ ] Health monitoring configured
- [ ] Log rotation configured
- [ ] Documentation reviewed
- [ ] Team trained on operations

## Verification

- [ ] All health endpoints responding:
  - [ ] `http://localhost:3001/health`
  - [ ] `http://localhost:3001/health/liveness`
  - [ ] `http://localhost:3001/health/readiness`
  - [ ] `http://localhost:8000/api/v1/health`
- [ ] Dashboard loads correctly
- [ ] Database connectivity verified
- [ ] Redis connectivity verified
- [ ] AI services responding
- [ ] No debug information exposed
- [ ] Logs contain no sensitive data

## Maintenance

- [ ] Backup schedule configured
- [ ] Backup retention policy set
- [ ] Monitoring alerts configured
- [ ] Update procedure documented
- [ ] Rollback procedure documented
- [ ] Support contacts documented

## Production Settings Verification

Run these checks to ensure production settings:

```bash
# Check environment
docker-compose -f docker-compose.prod.yml exec api printenv | grep -E "NODE_ENV|DEBUG|DB_SYNCHRONIZE|DB_LOGGING"

# Expected output:
# NODE_ENV=production
# DEBUG=false
# DB_SYNCHRONIZE=false
# DB_LOGGING=false

# Check API docs are disabled
curl http://localhost:3001/api/docs
# Should return 404 or not accessible

# Check AI services docs are disabled
curl http://localhost:8000/api/docs
# Should return 404 or not accessible
```

## Sign-Off

- [ ] All checklist items completed
- [ ] System tested and verified
- [ ] Documentation reviewed
- [ ] Team notified of deployment
- [ ] Monitoring active
- [ ] Backup system verified

**Deployed by:** _________________  
**Date:** _________________  
**Version:** _________________
