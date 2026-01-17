/** Rate limiting module. */

import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          throttlers: [{
            ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10), // 60 seconds
            limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // 100 requests per window
          }],
          storage: undefined, // Use in-memory storage (can be extended with Redis)
        };
      },
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitingModule {}
