/**
 * Service for managing device streaming state.
 * 
 * Security: Stream info includes jailId for ownership verification.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface StreamingDevice {
  deviceId: string;
  inmateDeviceId: string;
  deviceSerial: string;
  jailId: string;  // Required for ownership verification
  startedAt: Date;
  lastDataReceivedAt: Date;
}

@Injectable()
export class DeviceStreamingService {
  private readonly logger = new Logger(DeviceStreamingService.name);
  private readonly activeStreams = new Map<string, StreamingDevice>();

  constructor() {}

  /**
   * Start streaming for a device.
   */
  async startStreaming(config: {
    deviceId: string;
    inmateDeviceId: string;
    deviceSerial: string;
    jailId: string;  // Required
  }): Promise<void> {
    const now = new Date();

    this.activeStreams.set(config.deviceId, {
      deviceId: config.deviceId,
      inmateDeviceId: config.inmateDeviceId,
      deviceSerial: config.deviceSerial,
      jailId: config.jailId,
      startedAt: now,
      lastDataReceivedAt: now,
    });

    this.logger.log(
      `Streaming started for device ${config.deviceId} (${config.deviceSerial}) in jail ${config.jailId}`,
    );

    // Emit streaming started event (can be used for notifications)
    // This could trigger WebSocket notifications, etc.
  }

  /**
   * Stop streaming for a device.
   */
  async stopStreaming(deviceId: string): Promise<void> {
    const stream = this.activeStreams.get(deviceId);
    if (stream) {
      this.activeStreams.delete(deviceId);
      this.logger.log(
        `Streaming stopped for device ${deviceId} (${stream.deviceSerial})`,
      );
    }
  }

  /**
   * Check if device is actively streaming.
   */
  isStreaming(deviceId: string): boolean {
    return this.activeStreams.has(deviceId);
  }

  /**
   * Update last data received timestamp.
   */
  updateLastDataReceived(deviceId: string): void {
    const stream = this.activeStreams.get(deviceId);
    if (stream) {
      stream.lastDataReceivedAt = new Date();
    }
  }

  /**
   * Get all active streams.
   */
  getActiveStreams(): StreamingDevice[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Get all active streams for a specific jail.
   */
  getActiveStreamsForJail(jailId: string): StreamingDevice[] {
    return Array.from(this.activeStreams.values()).filter(
      (stream) => stream.jailId === jailId,
    );
  }

  /**
   * Get stream info for a device.
   */
  getStreamInfo(deviceId: string): StreamingDevice | undefined {
    return this.activeStreams.get(deviceId);
  }

  /**
   * Get inmate device ID for a device (if streaming).
   */
  getInmateDeviceId(deviceId: string): string | null {
    const stream = this.activeStreams.get(deviceId);
    return stream?.inmateDeviceId || null;
  }

  /**
   * Verify device belongs to jail (for ownership checks).
   */
  verifyStreamOwnership(deviceId: string, jailId: string): boolean {
    const stream = this.activeStreams.get(deviceId);
    return stream?.jailId === jailId;
  }
}
