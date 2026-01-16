/** WebSocket gateway for real-time updates. */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import {
  RealtimeEvent,
  VitalMetricEvent,
  AlertEvent,
  DeviceStatusEvent,
  ConnectionStatusEvent,
} from './types/realtime.types';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clientSubscriptions = new Map<
    string,
    Set<string>
  >(); // clientId -> Set<subscriptionType>

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.sendConnectionStatus(client, true, 'Connected to real-time updates');

    // Send initial connection status
    client.emit(RealtimeEvent.CONNECTION_STATUS, {
      connected: true,
      timestamp: new Date().toISOString(),
      message: 'Connected to real-time updates',
    } as ConnectionStatusEvent);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clientSubscriptions.delete(client.id);
  }

  @SubscribeMessage(RealtimeEvent.SUBSCRIBE_VITALS)
  handleSubscribeVitals(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId?: string },
  ): void {
    this.logger.debug(`Client ${client.id} subscribed to vitals`);
    this.addSubscription(client.id, 'vitals');
    client.emit(RealtimeEvent.CONNECTION_STATUS, {
      connected: true,
      timestamp: new Date().toISOString(),
      message: 'Subscribed to vital metrics',
    } as ConnectionStatusEvent);
  }

  @SubscribeMessage(RealtimeEvent.UNSUBSCRIBE_VITALS)
  handleUnsubscribeVitals(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client ${client.id} unsubscribed from vitals`);
    this.removeSubscription(client.id, 'vitals');
  }

  @SubscribeMessage(RealtimeEvent.SUBSCRIBE_ALERTS)
  handleSubscribeAlerts(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client ${client.id} subscribed to alerts`);
    this.addSubscription(client.id, 'alerts');
    client.emit(RealtimeEvent.CONNECTION_STATUS, {
      connected: true,
      timestamp: new Date().toISOString(),
      message: 'Subscribed to alerts',
    } as ConnectionStatusEvent);
  }

  @SubscribeMessage(RealtimeEvent.UNSUBSCRIBE_ALERTS)
  handleUnsubscribeAlerts(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client ${client.id} unsubscribed from alerts`);
    this.removeSubscription(client.id, 'alerts');
  }

  @SubscribeMessage(RealtimeEvent.SUBSCRIBE_DEVICE_STATUS)
  handleSubscribeDeviceStatus(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client ${client.id} subscribed to device status`);
    this.addSubscription(client.id, 'device-status');
    client.emit(RealtimeEvent.CONNECTION_STATUS, {
      connected: true,
      timestamp: new Date().toISOString(),
      message: 'Subscribed to device status',
    } as ConnectionStatusEvent);
  }

  @SubscribeMessage(RealtimeEvent.UNSUBSCRIBE_DEVICE_STATUS)
  handleUnsubscribeDeviceStatus(@ConnectedSocket() client: Socket): void {
    this.logger.debug(`Client ${client.id} unsubscribed from device status`);
    this.removeSubscription(client.id, 'device-status');
  }

  /**
   * Emit vital metric to all subscribed clients.
   */
  emitVitalMetric(event: VitalMetricEvent): void {
    this.server.emit(RealtimeEvent.VITAL_METRIC, event);
    this.logger.debug(`Emitted vital metric for device ${event.deviceId}`);
  }

  /**
   * Emit alert to all subscribed clients.
   */
  emitAlert(event: AlertEvent): void {
    this.server.emit(RealtimeEvent.ALERT_CREATED, event);
    this.logger.debug(`Emitted alert ${event.alertId}`);
  }

  /**
   * Emit alert update to all subscribed clients.
   */
  emitAlertUpdate(event: AlertEvent): void {
    this.server.emit(RealtimeEvent.ALERT_UPDATED, event);
    this.logger.debug(`Emitted alert update ${event.alertId}`);
  }

  /**
   * Emit device status to all subscribed clients.
   */
  emitDeviceStatus(event: DeviceStatusEvent): void {
    this.server.emit(RealtimeEvent.DEVICE_STATUS, event);
    this.logger.debug(`Emitted device status for device ${event.deviceId}`);
  }

  /**
   * Send connection status to a specific client.
   */
  private sendConnectionStatus(
    client: Socket,
    connected: boolean,
    message?: string,
  ): void {
    client.emit(RealtimeEvent.CONNECTION_STATUS, {
      connected,
      timestamp: new Date().toISOString(),
      message,
    } as ConnectionStatusEvent);
  }

  /**
   * Add subscription for a client.
   */
  private addSubscription(clientId: string, subscriptionType: string): void {
    if (!this.clientSubscriptions.has(clientId)) {
      this.clientSubscriptions.set(clientId, new Set());
    }
    this.clientSubscriptions.get(clientId)!.add(subscriptionType);
  }

  /**
   * Remove subscription for a client.
   */
  private removeSubscription(clientId: string, subscriptionType: string): void {
    const subscriptions = this.clientSubscriptions.get(clientId);
    if (subscriptions) {
      subscriptions.delete(subscriptionType);
      if (subscriptions.size === 0) {
        this.clientSubscriptions.delete(clientId);
      }
    }
  }

  /**
   * Get number of connected clients.
   */
  getConnectedClientsCount(): number {
    return this.server.sockets.sockets.size;
  }
}
