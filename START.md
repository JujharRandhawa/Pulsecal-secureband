# PulseCal SecureBand - Quick Start Guide

## 🚀 One-Click Launch

Simply double-click one of these files to start the application:

- **`START.bat`** - Windows Batch script (simple, works on all Windows versions)
- **`START.ps1`** - PowerShell script (more features, better error handling)

## 📋 What the Launcher Does

1. ✅ Checks if Node.js, pnpm, and Python are installed
2. ✅ Installs missing dependencies automatically
3. ✅ Builds required packages
4. ✅ Checks for port conflicts
5. ✅ Starts all three services in separate windows:
   - **Web Dashboard** (Port 3000)
   - **API Server** (Port 3001)
   - **AI Services** (Port 8000)
6. ✅ Opens the dashboard in your browser

## 🌐 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Web Dashboard | 3000 | http://localhost:3000 |
| API Server | 3001 | http://localhost:3001 |
| AI Services | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

## ⚙️ Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **pnpm** 8+ (installed automatically if missing)
- **Python** 3.11+ ([Download](https://www.python.org/)) - Optional, for AI services

## 🛑 Stopping Services

To stop all services, simply close the three service windows that were opened.

## 🔧 Manual Start (Alternative)

If you prefer to start services manually:

```bash
# Install dependencies (first time only)
pnpm install

# Build shared package (first time only)
pnpm --filter shared build

# Start all services
pnpm dev
```

Or start individually:

```bash
# Web Dashboard
pnpm --filter web dev

# API Server
pnpm --filter api start:dev

# AI Services
cd packages/ai-services
python run.py
```

## 📝 Notes

- First startup may take 30-60 seconds as services compile and initialize
- Make sure ports 3000, 3001, and 8000 are not in use by other applications
- The launcher will warn you if ports are already in use
- All services run in development mode for easy debugging

## 🐛 Troubleshooting

**Port already in use:**
- Close other applications using ports 3000, 3001, or 8000
- Or change ports in `env.example` and create a `.env` file

**Services not starting:**
- Check that Node.js and Python are properly installed
- Run `pnpm install` manually to ensure dependencies are installed
- Check the service windows for error messages

**Browser not opening:**
- Manually navigate to http://localhost:3000
- Wait a few more seconds for services to fully start
