# PulseCal SecureBand

A production-grade monorepo for a government wearable monitoring platform.

## 🚀 Quick Start (One-Click Launch)

**For Windows users:** Simply double-click `START.bat` or `START.ps1` to launch the entire application!

The launcher will:
- ✅ Check and install prerequisites
- ✅ Install dependencies automatically
- ✅ Start all services (Web, API, AI Services)
- ✅ Open the dashboard in your browser

📖 **See [START.md](./START.md) for detailed launcher documentation.**

**Service Ports:**
- Web Dashboard: http://localhost:3000
- API Server: http://localhost:3001
- AI Services: http://localhost:8000

## 📁 Project Structure

```
pulsecal-secureband/
├── docs/
│   ├── ARCHITECTURE.md              # Complete system architecture
│   └── ARCHITECTURE_QUICK_REFERENCE.md  # Quick reference guide
├── packages/
│   ├── shared/          # Shared TypeScript types and schemas
│   ├── web/             # Next.js App Router frontend
│   ├── api/             # NestJS backend API
│   └── ai-services/     # Python FastAPI AI services
├── scripts/             # Utility scripts
├── docker-compose.yml   # Docker orchestration
├── package.json         # Root package.json with workspace scripts
├── pnpm-workspace.yaml  # pnpm workspace configuration
├── tsconfig.json        # Root TypeScript configuration
├── .eslintrc.json       # ESLint configuration
└── .prettierrc.json     # Prettier configuration
```

## 🏗️ Architecture

This monorepo implements a production-grade architecture for a government wearable monitoring platform. The system architecture includes:

- **Component diagrams** - Detailed system components and interactions
- **Event-driven data flow** - Asynchronous processing via message queues
- **Failure handling strategies** - Circuit breakers, retries, and graceful degradation
- **Security boundaries** - Multi-layer security with encryption and authentication
- **Scaling approach** - Horizontal scaling from 100 to 10,000+ devices

📖 **See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for complete architecture documentation.**

## 🗄️ Database Schema

The database schema is designed for PostgreSQL with TimescaleDB extension:

- **ER diagrams** - Complete entity relationship diagrams
- **SQL schema** - Production-ready schema with all tables, indexes, and triggers
- **Time-series optimization** - TimescaleDB hypertables for efficient metric storage
- **Retention policies** - Automated data lifecycle management
- **Indexing strategy** - Optimized for common query patterns

📖 **See [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for complete database documentation.**

## 🚀 Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Python** >= 3.11 (for AI services)
- **Docker** and **Docker Compose** (optional, for containerized deployment)

## 📦 Installation

### 1. Install pnpm (if not already installed)

```bash
npm install -g pnpm@8.15.0
```

### 2. Install dependencies

```bash
# Install all workspace dependencies
pnpm install
```

### 3. Build shared package

```bash
# Build the shared package first (required for other packages)
pnpm --filter shared build
```

## 🏃 Running Services

### Development Mode

#### Run all services concurrently

```bash
pnpm dev
```

This will start:
- **Web** (Next.js) on `http://localhost:3000`
- **API** (NestJS) on `http://localhost:3001`
- **AI Services** (FastAPI) on `http://localhost:8000`

#### Run services individually

**Web (Next.js):**
```bash
cd packages/web
pnpm dev
```

**API (NestJS):**
```bash
cd packages/api
pnpm start:dev
```

**AI Services (FastAPI):**
```bash
cd packages/ai-services

# Using pip
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py

# Or using Poetry (recommended)
poetry install
poetry run python run.py
```

### Production Mode

#### Build all packages

```bash
pnpm build
```

#### Run production builds

**Web:**
```bash
cd packages/web
pnpm build
pnpm start
```

**API:**
```bash
cd packages/api
pnpm build
pnpm start:prod
```

**AI Services:**
```bash
cd packages/ai-services
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 🐳 Docker Deployment

### Build and run with Docker Compose

```bash
# Build all services
pnpm docker:build

# Start all services
pnpm docker:up

# Stop all services
pnpm docker:down

# View logs
pnpm docker:logs
```

Or use Docker Compose directly:

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## 🔧 Development Scripts

### Root-level scripts

```bash
# Development
pnpm dev                    # Run all services in dev mode

# Building
pnpm build                  # Build all packages

# Code Quality
pnpm lint                   # Lint all packages
pnpm lint:fix               # Fix linting issues
pnpm format                 # Format code with Prettier
pnpm format:check           # Check code formatting
pnpm type-check             # Type check all packages

# Docker
pnpm docker:build           # Build Docker images
pnpm docker:up               # Start Docker containers
pnpm docker:down             # Stop Docker containers
pnpm docker:logs             # View Docker logs

# Cleanup
pnpm clean                  # Remove all build artifacts and node_modules
```

### Package-specific scripts

Each package has its own scripts defined in its `package.json`. Use the `--filter` flag to run them:

```bash
pnpm --filter @pulsecal/web dev
pnpm --filter @pulsecal/api start:dev
pnpm --filter @pulsecal/shared build
```

## 🌍 Environment Variables

### Web Package (`packages/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_SERVICES_URL=http://localhost:8000
NODE_ENV=development
```

### API Package (`packages/api/.env`)

```env
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### AI Services Package (`packages/ai-services/.env`)

```env
HOST=0.0.0.0
PORT=8000
DEBUG=true
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
AI_SERVICE_ENABLED=true
```

**Note:** Copy the `.env.example` files to `.env` or `.env.local` and configure as needed.

## 📝 Code Quality

### TypeScript

- Strict mode enabled
- All packages use consistent TypeScript configuration
- Shared types in `packages/shared`

### ESLint

- Extended TypeScript rules
- Import ordering and organization
- Consistent code style enforcement

### Prettier

- Consistent formatting across all packages
- Integrated with ESLint

## 🏗️ Architecture

### Monorepo Structure

This monorepo uses **pnpm workspaces** for dependency management and code sharing.

- **Shared Package**: Common TypeScript types and schemas used across all services
- **Web Package**: Next.js 14 with App Router for the frontend
- **API Package**: NestJS backend API
- **AI Services Package**: Python FastAPI microservice for AI/ML operations

### Package Dependencies

```
web → shared
api → shared
ai-services (independent, Python)
```

## 🔒 Security Notes

- No authentication is implemented yet (as per requirements)
- No mock data is included (as per requirements)
- Environment variables should be properly secured in production
- CORS is configured but should be tightened for production

## 📚 Next Steps

1. Configure environment variables for your deployment
2. Set up database connections (when ready)
3. Implement authentication and authorization
4. Add business logic and features
5. Configure CI/CD pipelines
6. Set up monitoring and logging

## 🤝 Contributing

1. Follow the established code style (ESLint + Prettier)
2. Run type checking and linting before committing
3. Ensure all packages build successfully
4. Test your changes in development mode

## 📄 License

[To be determined]

---

**Note:** This is a scaffolded monorepo structure. Features, authentication, and business logic are to be implemented separately.
