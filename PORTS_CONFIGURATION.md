# PulseCal SecureBand - Port Configuration

## 📋 Standard Port Assignments

All ports are configured consistently across the entire application:

| Service | Port | Protocol | Configuration Files |
|---------|------|----------|---------------------|
| **Web Dashboard** | `3000` | HTTP | `next.config.js`, `env.example`, `docker-compose.yml` |
| **API Server** | `3001` | HTTP/WebSocket | `main.ts`, `configuration.ts`, `env.example` |
| **AI Services** | `8000` | HTTP | `config.py`, `run.py`, `env.example` |
| **PostgreSQL** | `5432` | TCP | `configuration.ts`, `docker-compose.yml` |
| **Redis** | `6379` | TCP | `configuration.ts`, `docker-compose.yml` |

## ✅ Port Verification

All ports are correctly configured in:

### Web Package (`packages/web/`)
- ✅ `next.config.js` - Default API URL: `http://localhost:3001`
- ✅ `next.config.js` - Default AI Services URL: `http://localhost:8000`
- ✅ All components use `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`
- ✅ WebSocket connections use port 3001

### API Package (`packages/api/`)
- ✅ `main.ts` - Default port: `3001`
- ✅ `configuration.ts` - Port from env: `PORT || 3001`
- ✅ `configuration.ts` - CORS origin: `http://localhost:3000`
- ✅ `configuration.ts` - AI Services URL: `http://localhost:8000`
- ✅ Database port: `5432`
- ✅ Redis port: `6379`

### AI Services Package (`packages/ai-services/`)
- ✅ `config.py` - Default port: `8000`
- ✅ `config.py` - CORS origins: `["http://localhost:3000", "http://localhost:3001"]`
- ✅ `run.py` - Uses port from settings

### Docker Configuration
- ✅ `docker-compose.yml` - All ports mapped correctly
- ✅ `docker-compose.prod.yml` - Production ports with environment variable support
- ✅ Health checks configured for all services

### Environment Files
- ✅ `env.example` - All ports documented with defaults
- ✅ Environment variables support port customization

## 🔍 Port Verification Script

Run the port verification script to check if ports are available:

```bash
node scripts/verify-ports.js
```

Or use the launcher scripts which automatically check ports:
- `START.bat` (Windows)
- `START.ps1` (PowerShell)

## 🔧 Changing Ports

If you need to change ports, update these files:

1. **Web Port (3000):**
   - `env.example` → `WEB_PORT`
   - `packages/web/next.config.js` (if hardcoded)

2. **API Port (3001):**
   - `env.example` → `API_PORT`
   - `packages/api/src/config/configuration.ts`
   - `packages/web/next.config.js` → `NEXT_PUBLIC_API_URL`

3. **AI Services Port (8000):**
   - `env.example` → `AI_SERVICES_PORT`
   - `packages/ai-services/app/config.py`
   - `packages/web/next.config.js` → `NEXT_PUBLIC_AI_SERVICES_URL`
   - `packages/api/src/config/configuration.ts` → `aiServices.url`

4. **Database Port (5432):**
   - `env.example` → `DB_PORT`
   - `packages/api/src/config/configuration.ts`

5. **Redis Port (6379):**
   - `env.example` → `REDIS_PORT`
   - `packages/api/src/config/configuration.ts`

## ✅ Production Readiness

All ports are:
- ✅ Consistent across all configuration files
- ✅ Documented in `env.example`
- ✅ Configurable via environment variables
- ✅ Verified by launcher scripts
- ✅ Health-checked in Docker configurations
- ✅ Following industry standards (no conflicts with common services)

## 🚨 Port Conflicts

If you encounter port conflicts:

1. **Check what's using the port:**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Linux/Mac
   lsof -i :3000
   ```

2. **Change ports in `.env` file:**
   ```env
   WEB_PORT=3000
   API_PORT=3001
   AI_SERVICES_PORT=8000
   ```

3. **Update CORS origins** if changing web or API ports

4. **Restart all services** after port changes

## 📝 Notes

- Ports 3000-3001 and 8000 are standard for development
- Production deployments should use environment variables
- Docker Compose handles port mapping automatically
- All services check port availability on startup
