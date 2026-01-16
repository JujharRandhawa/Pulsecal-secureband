# PulseCal SecureBand API

NestJS backend for PulseCal SecureBand with PostgreSQL + TimescaleDB integration.

## Features

- ✅ Modular architecture
- ✅ PostgreSQL + TimescaleDB integration
- ✅ Configuration management
- ✅ Structured logging (Winston)
- ✅ Health check endpoints
- ✅ TypeORM for database operations

## Project Structure

```
src/
├── config/           # Configuration module
│   ├── config.module.ts
│   ├── config.service.ts
│   └── configuration.ts
├── database/         # Database module
│   └── database.module.ts
├── health/           # Health check module
│   ├── health.module.ts
│   ├── health.controller.ts
│   └── database.health.ts
├── common/           # Common utilities
│   └── logger/       # Logger module
│       └── logger.module.ts
├── app.module.ts     # Root module
├── app.controller.ts # Root controller
├── app.service.ts    # Root service
└── main.ts           # Application entry point
```

## Environment Variables

Create a `.env` file in the `packages/api` directory:

```env
# Application Configuration
APP_NAME=PulseCal SecureBand API
APP_VERSION=1.0.0
NODE_ENV=development
PORT=3001

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=pulsecal
DB_SSL=false
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

## Installation

```bash
# Install dependencies
pnpm install

# Or from the root
pnpm install --filter @pulsecal/api
```

## Running the Application

```bash
# Development mode
pnpm start:dev

# Production mode
pnpm build
pnpm start:prod
```

## Health Check Endpoints

- `GET /health` - Full health check (includes database)
- `GET /health/liveness` - Liveness probe (always returns OK)
- `GET /health/readiness` - Readiness probe (checks database connection)

## Database Setup

The application uses PostgreSQL with TimescaleDB extension. The database schema is located in `../../database/schema.sql`.

When using Docker Compose, the database will be automatically initialized with the schema.

## Logging

The application uses Winston for structured logging. Logs are output in JSON format in production and formatted for readability in development.

Log levels:
- `debug` - Development only
- `info` - General information
- `warn` - Warnings
- `error` - Errors

## Development

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Format code
pnpm format
```
