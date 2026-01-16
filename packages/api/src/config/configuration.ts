export default () => ({
  app: {
    name: process.env.APP_NAME || 'PulseCal SecureBand API',
    version: process.env.APP_VERSION || '1.0.0',
    port: parseInt(process.env.PORT || '3001', 10),
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'pulsecal',
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  aiServices: {
    url: process.env.AI_SERVICES_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.AI_SERVICES_TIMEOUT || '10000', 10),
    enabled: process.env.AI_SERVICES_ENABLED !== 'false',
  },
});
