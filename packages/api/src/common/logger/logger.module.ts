import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.app?.env === 'production';
        const logDir = process.env.LOG_DIR || './logs';
        const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

        const transports: winston.transport[] = [
          // Console transport (always enabled)
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, context, ...meta }) => {
                  const contextStr = context ? `[${context}]` : '';
                  const metaStr =
                    Object.keys(meta).length > 0
                      ? ` ${JSON.stringify(meta)}`
                      : '';
                  return `${timestamp} ${level} ${contextStr} ${message}${metaStr}`;
                },
              ),
            ),
          }),
        ];

        // File transports (production)
        if (isProduction || process.env.ENABLE_FILE_LOGGING === 'true') {
          // Combined log file
          transports.push(
            new DailyRotateFile({
              dirname: logDir,
              filename: 'application-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              maxSize: '20m',
              maxFiles: '14d',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json(),
              ),
            }),
          );

          // Error log file
          transports.push(
            new DailyRotateFile({
              dirname: logDir,
              filename: 'error-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              level: 'error',
              maxSize: '20m',
              maxFiles: '30d',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json(),
              ),
            }),
          );
        }

        // Remote logging (if configured)
        if (process.env.LOGSTASH_HOST) {
          // Example: Add Logstash transport if needed
          // transports.push(new winston.transports.Http({
          //   host: process.env.LOGSTASH_HOST,
          //   port: parseInt(process.env.LOGSTASH_PORT || '5000', 10),
          // }));
        }

        return {
          level: logLevel,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json(),
          ),
          defaultMeta: {
            service: configService.app?.name || 'pulsecal-api',
            version: configService.app?.version || '1.0.0',
            environment: configService.app?.env || 'development',
          },
          transports,
          exceptionHandlers: isProduction
            ? [
                new DailyRotateFile({
                  dirname: logDir,
                  filename: 'exceptions-%DATE%.log',
                  datePattern: 'YYYY-MM-DD',
                  maxSize: '20m',
                  maxFiles: '30d',
                }),
              ]
            : undefined,
          rejectionHandlers: isProduction
            ? [
                new DailyRotateFile({
                  dirname: logDir,
                  filename: 'rejections-%DATE%.log',
                  datePattern: 'YYYY-MM-DD',
                  maxSize: '20m',
                  maxFiles: '30d',
                }),
              ]
            : undefined,
        };
      },
    }),
  ],
})
export class LoggerModule {}
