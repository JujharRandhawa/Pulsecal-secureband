/**
 * Service for monitoring device health and handling offline devices gracefully.
 * 
 * Features:
 * - Monitors device heartbeat/last seen timestamps
 * - Marks devices as offline after configurable timeout
 * - Emits real-time alerts for offline devices
 * - Provides graceful degradation for offline devices
 * - Tracks device health history for forensic purposes
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { DeviceStatus } from '../../entities/device-status.entity';
import { Alert, AlertSeverity, AlertStatus, AlertType } from '../../entities/alert.entity';
import { DeviceStreamingService } from './device-streaming.service';
import { RealtimeEmitterService } from '../../realtime/services/realtime-emitter.service';

interface MonitoredDevice {
  deviceId: string;
  jailId: string;
  lastSeenAt: Date;
  silentThreshold: number; // milliseconds
  isOffline: boolean;
  offlineSince: Date | null;
  alertId: string | null;
}

export enum DeviceHealthStatus {
  ONLINE = 'online',
  DEGRADED = 'degraded',  // Intermittent connection
  OFFLINE = 'offline',
  UNKNOWN = 'unknown',
}

@Injectable()
export class DeviceHealthMonitor implements OnModuleDestroy {
  private readonly logger = new Logger(DeviceHealthMonitor.name);
  private readonly monitoredDevices = new Map<string, MonitoredDevice>();
  
  // Configurable thresholds
  private readonly SILENT_THRESHOLD_MS = 5 * 60 * 1000;      // 5 minutes - mark as offline
  private readonly DEGRADED_THRESHOLD_MS = 2 * 60 * 1000;    // 2 minutes - warn about degraded connection
  private readonly CHECK_INTERVAL_MS = 30 * 1000;            // Check every 30 seconds
  private readonly ALERT_COOLDOWN_MS = 15 * 60 * 1000;       // 15 minutes between repeated alerts
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly alertCooldowns = new Map<string, Date>();

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(DeviceStatus)
    private deviceStatusRepository: Repository<DeviceStatus>,
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    private deviceStreamingService: DeviceStreamingService,
    private realtimeEmitter: RealtimeEmitterService,
  ) {
    this.startHealthCheckLoop();
  }

  /**
   * Register a device for health monitoring.
   */
  registerDevice(deviceId: string, jailId?: string): void {
    if (this.monitoredDevices.has(deviceId)) {
      this.logger.debug(`Device ${deviceId} already registered for monitoring`);
      return;
    }

    const monitored: MonitoredDevice = {
      deviceId,
      jailId: jailId || 'unknown',
      lastSeenAt: new Date(),
      silentThreshold: this.SILENT_THRESHOLD_MS,
      isOffline: false,
      offlineSince: null,
      alertId: null,
    };

    this.monitoredDevices.set(deviceId, monitored);
    this.logger.debug(`Device ${deviceId} registered for health monitoring`);
  }

  /**
   * Unregister a device from health monitoring.
   */
  unregisterDevice(deviceId: string): void {
    this.monitoredDevices.delete(deviceId);
    this.alertCooldowns.delete(deviceId);
    this.logger.debug(`Device ${deviceId} unregistered from health monitoring`);
  }

  /**
   * Update last seen timestamp for a device.
   * This should be called every time data is received from the device.
   */
  updateLastSeen(deviceId: string): void {
    const monitored = this.monitoredDevices.get(deviceId);
    if (monitored) {
      const wasOffline = monitored.isOffline;
      monitored.lastSeenAt = new Date();
      
      // If device was offline, mark it as back online
      if (wasOffline) {
        monitored.isOffline = false;
        monitored.offlineSince = null;
        this.handleDeviceReconnection(deviceId, monitored).catch((error) => {
          this.logger.error(`Failed to handle device reconnection: ${error.message}`);
        });
      }
    }

    // Also update device entity (gracefully handle failures)
    this.deviceRepository
      .update({ id: deviceId }, { lastSeenAt: new Date() })
      .catch((error) => {
        this.logger.warn(
          `Failed to update lastSeenAt for device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
  }

  /**
   * Get health status for a device.
   */
  getDeviceHealth(deviceId: string): DeviceHealthStatus {
    const monitored = this.monitoredDevices.get(deviceId);
    if (!monitored) {
      return DeviceHealthStatus.UNKNOWN;
    }

    const timeSinceLastSeen = Date.now() - monitored.lastSeenAt.getTime();

    if (timeSinceLastSeen > this.SILENT_THRESHOLD_MS) {
      return DeviceHealthStatus.OFFLINE;
    } else if (timeSinceLastSeen > this.DEGRADED_THRESHOLD_MS) {
      return DeviceHealthStatus.DEGRADED;
    }
    
    return DeviceHealthStatus.ONLINE;
  }

  /**
   * Get all offline devices.
   */
  getOfflineDevices(): string[] {
    const offline: string[] = [];
    for (const [deviceId, monitored] of this.monitoredDevices.entries()) {
      if (monitored.isOffline) {
        offline.push(deviceId);
      }
    }
    return offline;
  }

  /**
   * Get offline duration for a device.
   */
  getOfflineDuration(deviceId: string): number | null {
    const monitored = this.monitoredDevices.get(deviceId);
    if (!monitored || !monitored.offlineSince) {
      return null;
    }
    return Date.now() - monitored.offlineSince.getTime();
  }

  /**
   * Start health check loop.
   */
  private startHealthCheckLoop(): void {
    this.healthCheckInterval = setInterval(() => {
      this.checkDeviceHealth().catch((error) => {
        this.logger.error(
          `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
    }, this.CHECK_INTERVAL_MS);

    this.logger.log('Device health monitor started');
  }

  /**
   * Check health of all monitored devices.
   */
  private async checkDeviceHealth(): Promise<void> {
    const now = Date.now();

    for (const [deviceId, monitored] of this.monitoredDevices.entries()) {
      try {
        const timeSinceLastSeen = now - monitored.lastSeenAt.getTime();

        if (timeSinceLastSeen > this.SILENT_THRESHOLD_MS && !monitored.isOffline) {
          // Device has gone offline
          await this.handleDeviceOffline(deviceId, monitored);
        } else if (timeSinceLastSeen > this.DEGRADED_THRESHOLD_MS && !monitored.isOffline) {
          // Device connection is degraded - emit warning
          await this.handleDegradedConnection(deviceId, monitored);
        }
      } catch (error) {
        // Graceful failure - log and continue checking other devices
        this.logger.error(
          `Health check failed for device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  /**
   * Handle device going offline.
   */
  private async handleDeviceOffline(deviceId: string, monitored: MonitoredDevice): Promise<void> {
    monitored.isOffline = true;
    monitored.offlineSince = new Date();

    const device = await this.deviceRepository.findOne({
      where: { id: deviceId },
    });

    // Create offline status record
    const offlineStatus = this.deviceStatusRepository.create({
      deviceId,
      recordedAt: new Date(),
      connectionStatus: 'offline',
      batteryLevel: null,
      signalStrength: null,
      systemStatus: {
        reason: 'silent',
        lastSeenAt: device?.lastSeenAt?.toISOString() || null,
        offlineSince: monitored.offlineSince.toISOString(),
      },
    });

    await this.deviceStatusRepository.save(offlineStatus);

    // Create alert if not in cooldown
    if (!this.isInAlertCooldown(deviceId)) {
      await this.createOfflineAlert(deviceId, monitored, device);
      this.alertCooldowns.set(deviceId, new Date());
    }

    // Emit WebSocket event for real-time UI update
    this.realtimeEmitter.emitDeviceStatus({
      deviceId,
      connectionStatus: 'offline',
      batteryLevel: null,
      signalStrength: null,
      recordedAt: new Date().toISOString(),
    });

    this.logger.warn(
      `Device ${deviceId} marked as OFFLINE (silent for ${Math.round((Date.now() - monitored.lastSeenAt.getTime()) / 1000 / 60)} minutes)`,
    );
  }

  /**
   * Handle degraded connection warning.
   */
  private async handleDegradedConnection(deviceId: string, monitored: MonitoredDevice): Promise<void> {
    // Emit WebSocket event for real-time UI update
    this.realtimeEmitter.emitDeviceStatus({
      deviceId,
      connectionStatus: 'degraded',
      batteryLevel: null,
      signalStrength: null,
      recordedAt: new Date().toISOString(),
    });

    this.logger.debug(
      `Device ${deviceId} connection DEGRADED (no data for ${Math.round((Date.now() - monitored.lastSeenAt.getTime()) / 1000)} seconds)`,
    );
  }

  /**
   * Handle device reconnection.
   */
  private async handleDeviceReconnection(deviceId: string, monitored: MonitoredDevice): Promise<void> {
    const offlineDuration = monitored.offlineSince 
      ? Date.now() - monitored.offlineSince.getTime() 
      : 0;

    // Create online status record
    const onlineStatus = this.deviceStatusRepository.create({
      deviceId,
      recordedAt: new Date(),
      connectionStatus: 'online',
      batteryLevel: null,
      signalStrength: null,
      systemStatus: {
        reason: 'reconnected',
        offlineDurationMs: offlineDuration,
        previouslyOfflineSince: monitored.offlineSince?.toISOString() || null,
      },
    });

    await this.deviceStatusRepository.save(onlineStatus);

    // Resolve any offline alerts
    if (monitored.alertId) {
      await this.resolveOfflineAlert(monitored.alertId);
      monitored.alertId = null;
    }

    // Emit WebSocket event
    this.realtimeEmitter.emitDeviceStatus({
      deviceId,
      connectionStatus: 'online',
      batteryLevel: null,
      signalStrength: null,
      recordedAt: new Date().toISOString(),
    });

    this.logger.log(
      `Device ${deviceId} reconnected after ${Math.round(offlineDuration / 1000 / 60)} minutes offline`,
    );
  }

  /**
   * Check if device is in alert cooldown period.
   */
  private isInAlertCooldown(deviceId: string): boolean {
    const lastAlert = this.alertCooldowns.get(deviceId);
    if (!lastAlert) {
      return false;
    }
    return Date.now() - lastAlert.getTime() < this.ALERT_COOLDOWN_MS;
  }

  /**
   * Create an alert for offline device.
   */
  private async createOfflineAlert(
    deviceId: string, 
    monitored: MonitoredDevice,
    device: Device | null,
  ): Promise<void> {
    try {
      const alert = this.alertRepository.create({
        deviceId,
        alertType: AlertType.DEVICE_OFFLINE,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        description: `Device ${device?.serialNumber || deviceId} has gone offline. Last seen: ${monitored.lastSeenAt.toISOString()}`,
        triggeredAt: new Date(),
        metadata: {
          lastSeenAt: monitored.lastSeenAt.toISOString(),
          jailId: monitored.jailId,
          deviceSerial: device?.serialNumber || null,
        },
      });

      const savedAlert = await this.alertRepository.save(alert);
      monitored.alertId = savedAlert.id;

      // Emit alert via WebSocket
      this.realtimeEmitter.emitAlert({
        alertId: savedAlert.id,
        deviceId,
        inmateDeviceId: null,
        alertType: AlertType.DEVICE_OFFLINE,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.OPEN,
        description: alert.description,
        triggeredAt: savedAlert.triggeredAt.toISOString(),
      });
    } catch (error) {
      // Graceful failure - don't let alert creation failure break health monitoring
      this.logger.error(
        `Failed to create offline alert for device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Resolve an offline alert when device reconnects.
   */
  private async resolveOfflineAlert(alertId: string): Promise<void> {
    try {
      await this.alertRepository.update(
        { id: alertId },
        {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionNote: 'Device reconnected',
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to resolve alert ${alertId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Cleanup on module destroy.
   */
  onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.monitoredDevices.clear();
    this.alertCooldowns.clear();
    this.logger.log('Device health monitor stopped');
  }
}
