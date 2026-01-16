/** Real-time WebSocket module. */

import { Module, OnModuleInit } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEmitterService } from './services/realtime-emitter.service';

@Module({
  providers: [RealtimeGateway, RealtimeEmitterService],
  exports: [RealtimeGateway, RealtimeEmitterService],
})
export class RealtimeModule implements OnModuleInit {
  constructor(
    private gateway: RealtimeGateway,
    private emitterService: RealtimeEmitterService,
  ) {}

  onModuleInit() {
    // Set gateway reference in emitter service to avoid circular dependencies
    this.emitterService.setGateway(this.gateway);
  }
}
