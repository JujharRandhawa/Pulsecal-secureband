import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.database;

        return {
          type: 'postgres',
          host: dbConfig?.host,
          port: dbConfig?.port,
          username: dbConfig?.username,
          password: dbConfig?.password,
          database: dbConfig?.database,
          ssl: dbConfig?.ssl
            ? {
                rejectUnauthorized: false,
              }
            : false,
          synchronize: dbConfig?.synchronize || false,
          logging: dbConfig?.logging || false,
          autoLoadEntities: true,
          extra: {
            // TimescaleDB connection pool settings
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
