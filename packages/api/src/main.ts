import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { TracingService } from './observability/tracing/tracing.service';

async function bootstrap(): Promise<void> {
  // Disable debug in production
  if (process.env.NODE_ENV === 'production') {
    process.env.DEBUG = '';
    process.env.TRACING_ENABLED = 'false';
  }

  // Initialize tracing before creating app (if enabled)
  if (process.env.TRACING_ENABLED !== 'false' && process.env.NODE_ENV !== 'production') {
    // Tracing will be initialized by TracingService on module init
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn', 'log'] 
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Trust proxy for accurate IP addresses (important for IP restriction)
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', true);
  }

  // Enable WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Use Winston logger
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // Get config service
  const configService = app.get(ConfigService);

  // Enable CORS
  app.enableCors({
    origin: configService.cors?.origin || 'http://localhost:3000',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = configService.app?.port || 3001;
  await app.listen(port);

  logger.log(
    `🚀 API server running on http://localhost:${port}`,
    'Bootstrap',
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
