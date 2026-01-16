import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export interface AppConfig {
  app: {
    name: string;
    version: string;
    port: number;
    env: string;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    ssl: boolean;
    synchronize: boolean;
    logging: boolean;
  };
  cors: {
    origin: string;
  };
}

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  get app() {
    return this.configService.get<AppConfig['app']>('app');
  }

  get database() {
    return this.configService.get<AppConfig['database']>('database');
  }

  get cors() {
    return this.configService.get<AppConfig['cors']>('cors');
  }

  get<T = any>(key: string): T {
    return this.configService.get<T>(key);
  }
}
