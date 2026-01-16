/** Service for emitting real-time events without circular dependencies. */

import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from '../realtime.gateway';
import {
  VitalMetricEvent,
  AlertEvent,
  DeviceStatusEvent,
} from '../types/realtime.types';

@Injectable()
export class RealtimeEmitterService {
  private readonly logger = new Logger(RealtimeEmitterService.name);
  private gateway: RealtimeGateway | null = null;

  /**
   * Set the gateway instance (called by RealtimeModule).
   */
  setGateway(gateway: RealtimeGateway): void {
    this.gateway = gateway;
  }

  /**
   * Emit vital metric event.
   */
  emitVitalMetric(event: VitalMetricEvent): void {
    if (this.gateway) {
      this.gateway.emitVitalMetric(event);
    } else {
      this.logger.warn('RealtimeGateway not initialized, skipping vital metric emission');
    }
  }

  /**
   * Emit alert event.
   */
  emitAlert(event: AlertEvent): void {
    if (this.gateway) {
      this.gateway.emitAlert(event);
    } else {
      this.logger.warn('RealtimeGateway not initialized, skipping alert emission');
    }
  }

  /**
   * Emit alert update event.
   */
  emitAlertUpdate(event: AlertEvent): void {
    if (this.gateway) {
      this.gateway.emitAlertUpdate(event);
    } else {
      this.logger.warn('RealtimeGateway not initialized, skipping alert update emission');
    }
  }

  /**
   * Emit device status event.
   */
  emitDeviceStatus(event: DeviceStatusEvent): void {
    if (this.gateway) {
      this.gateway.emitDeviceStatus(event);
    } else {
      this.logger.warn('RealtimeGateway not initialized, skipping device status emission');
    }
  }
}
