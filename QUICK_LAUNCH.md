# 🚀 PulseCal SecureBand - Quick Launch Guide

## One-Click Start

**Simply double-click `START.bat` or `START.ps1` to launch the entire application!**

The launcher handles everything automatically:
- ✅ Checks prerequisites (Node.js, pnpm, Python)
- ✅ Installs missing dependencies
- ✅ Builds required packages
- ✅ Verifies port availability
- ✅ Starts all services
- ✅ Opens dashboard in browser

## 📍 What Gets Started

After launching, you'll have:

1. **Web Dashboard** (Port 3000)
   - Next.js application
   - Real-time monitoring interface
   - Device management
   - Alert dashboard

2. **API Server** (Port 3001)
   - NestJS backend
   - REST API endpoints
   - WebSocket server
   - Database connections

3. **AI Services** (Port 8000)
   - FastAPI microservice
   - Anomaly detection
   - Risk scoring
   - Signal quality analysis

## 🌐 Access Points

Once services are running:

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000 | Main web interface |
| **Login** | http://localhost:3000/login | Authentication page |
| **API Health** | http://localhost:3001/health | API status check |
| **AI Health** | http://localhost:8000/api/v1/health | AI services status |

## ⚙️ System Requirements

- **Node.js** 18.0.0 or higher
- **pnpm** 8.0.0 or higher (auto-installed if missing)
- **Python** 3.11+ (optional, for AI services)
- **Windows** 10/11 (for .bat/.ps1 launchers)

## 🛑 Stopping Services

To stop all services:
1. Close the three service windows that were opened
2. Or press `Ctrl+C` in each service window

## 🔧 Manual Alternative

If you prefer command line:

```bash
# Install dependencies (first time)
pnpm install

# Build shared package (first time)
pnpm --filter shared build

# Start all services
pnpm dev
```

## 📝 First Time Setup

On first launch, the launcher will:
1. Install pnpm globally (if missing)
2. Install all npm dependencies
3. Build the shared TypeScript package
4. Start all services

This may take 2-5 minutes the first time.

## 🐛 Troubleshooting

### Port Already in Use
- Close other applications using ports 3000, 3001, or 8000
- Or run `node scripts/verify-ports.js` to check port status

### Services Not Starting
- Ensure Node.js is installed: `node --version`
- Check service windows for error messages
- Try running `pnpm install` manually

### Browser Not Opening
- Manually navigate to http://localhost:3000
- Wait 30-60 seconds for services to fully start

### Python Not Found
- AI services won't start without Python
- Install from https://www.python.org/
- Restart the launcher

## 📚 More Information

- **Port Configuration**: See [PORTS_CONFIGURATION.md](./PORTS_CONFIGURATION.md)
- **Full Documentation**: See [README.md](./README.md)
- **Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Ready to launch?** Double-click `START.bat` now! 🚀
