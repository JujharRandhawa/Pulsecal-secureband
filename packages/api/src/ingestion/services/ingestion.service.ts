/**
 * Enhanced ingestion service with packet validation, sequence tracking, and timestamp correction.
 * 
 * Features:
 * - Validates all incoming packets
 * - Tracks packet sequences for missing/delayed detection
 * - Corrects timestamps (clock skew, future dates)
 * - Stores raw sensor data separately from AI inferences
 * - Handles device heartbeat monitoring
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { VitalMetric } from '../../entities/vital-metric.entity';
import { LocationMetric } from '../../entities/location-metric.entity';
import { DeviceStatus } from '../../entities/device-status.entity';
import { DeviceLookupService } from './device-lookup.service';
import { PacketValidatorService, PacketMetadata } from './packet-validator.service';
import { EventPublisherService } from '../../event-pipeline/services/event-publisher.service';
import { RealtimeEmitterService } from '../../realtime/services/realtime-emitter.service';
import { DeviceBindingService } from '../../device-management/services/device-binding.service';
import { DeviceStreamingService } from '../../device-management/services/device-streaming.service';
import { DeviceHealthMonitor } from '../../device-management/services/device-health-monitor.service';
import {
  PpgDataDto,
  TemperatureDataDto,
  ImuDataDto,
  DeviceStatusDto,
} from '../dto';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly BATCH_SIZE = 500; // Insert in batches for performance

  constructor(
    @InjectRepository(VitalMetric)
    private vitalMetricRepository: Repository<VitalMetric>,
    @InjectRepository(LocationMetric)
    private locationMetricRepository: Repository<LocationMetric>,
    @InjectRepository(DeviceStatus)
    private deviceStatusRepository: Repository<DeviceStatus>,
    private deviceLookupService: DeviceLookupService,
    private packetValidator: PacketValidatorService,
    private dataSource: DataSource,
    private eventPublisher: EventPublisherService,
    private realtimeEmitter: RealtimeEmitterService,
    private deviceBindingService: DeviceBindingService,
    private deviceStreamingService: DeviceStreamingService,
    private deviceHealthMonitor: DeviceHealthMonitor,
  ) {}

  /**
   * Ingest PPG data with validation and sequence tracking.
   */
  async ingestPpgData(dto: PpgDataDto): Promise<void> {
    try {
      const deviceId = await this.deviceLookupService.getDeviceIdBySerial(
        dto.deviceSerial,
      );

      // Validate packet
      const validation = await this.packetValidator.validatePacket(
        {
          deviceId,
          deviceSerial: dto.deviceSerial,
          sequenceNumber: dto.sequenceNumber,
          recordedAt: new Date(dto.recordedAt),
          receivedAt: new Date(),
          packetType: 'vital',
        },
        dto,
      );

      if (!validation.valid) {
        throw new BadRequestException(
          `Packet validation failed: ${validation.errors.join(', ')}`,
        );
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        this.logger.warn(
          `PPG data warnings for ${dto.deviceSerial}: ${validation.warnings.join(', ')}`,
        );
      }

      // Use corrected timestamp if available
      const recordedAt = validation.correctedTimestamp || new Date(dto.recordedAt);

      // Check if device is bound and streaming, handle reconnection if needed
      await this.handleDeviceDataReceived(deviceId, dto.deviceSerial);

      // Store raw sensor data (separate from AI inferences)
      const metric = this.vitalMetricRepository.create({
        deviceId,
        recordedAt,
        heartRate: dto.heartRate ?? null,
        oxygenSaturation: dto.oxygenSaturation ?? null,
        bloodPressureSystolic: dto.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: dto.bloodPressureDiastolic ?? null,
        batteryLevel: dto.batteryLevel ?? null,
        signalStrength: dto.signalStrength ?? null,
        additionalMetrics: {
          ...(dto.additionalMetrics || {}),
          sequenceNumber: dto.sequenceNumber,
          validationWarnings: validation.warnings,
          sequenceStatus: validation.sequenceStatus,
        },
      });

      const savedMetric = await this.vitalMetricRepository.save(metric);

      // Update streaming service and health monitor
      this.deviceStreamingService.updateLastDataReceived(deviceId);
      this.deviceHealthMonitor.updateLastSeen(deviceId);

      // Publish event for alert processing (AI analysis happens separately)
      await this.publishMetricEvent(savedMetric, 'vital', dto.deviceSerial);
    } catch (error) {
      this.logger.error(`Failed to ingest PPG data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Ingest temperature data with validation.
   */
  async ingestTemperatureData(dto: TemperatureDataDto): Promise<void> {
    try {
      const deviceId = await this.deviceLookupService.getDeviceIdBySerial(
        dto.deviceSerial,
      );

      // Validate packet
      const validation = await this.packetValidator.validatePacket(
        {
          deviceId,
          deviceSerial: dto.deviceSerial,
          sequenceNumber: dto.sequenceNumber,
          recordedAt: new Date(dto.recordedAt),
          receivedAt: new Date(),
          packetType: 'vital',
        },
        dto,
      );

      if (!validation.valid) {
        throw new BadRequestException(
          `Packet validation failed: ${validation.errors.join(', ')}`,
        );
      }

      if (validation.warnings.length > 0) {
        this.logger.warn(
          `Temperature data warnings for ${dto.deviceSerial}: ${validation.warnings.join(', ')}`,
        );
      }

      const recordedAt = validation.correctedTimestamp || new Date(dto.recordedAt);

      await this.handleDeviceDataReceived(deviceId, dto.deviceSerial);

      // Store raw sensor data
      const metric = this.vitalMetricRepository.create({
        deviceId,
        recordedAt,
        temperatureCelsius: dto.temperatureCelsius,
        batteryLevel: dto.batteryLevel ?? null,
        signalStrength: dto.signalStrength ?? null,
        additionalMetrics: {
          ...(dto.additionalMetrics || {}),
          sequenceNumber: dto.sequenceNumber,
          validationWarnings: validation.warnings,
          sequenceStatus: validation.sequenceStatus,
        },
      });

      const savedMetric = await this.vitalMetricRepository.save(metric);

      this.deviceStreamingService.updateLastDataReceived(deviceId);
      this.deviceHealthMonitor.updateLastSeen(deviceId);

      await this.publishMetricEvent(savedMetric, 'vital', dto.deviceSerial);
    } catch (error) {
      this.logger.error(
        `Failed to ingest temperature data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Ingest IMU data with validation.
   */
  async ingestImuData(dto: ImuDataDto): Promise<void> {
    try {
      const deviceId = await this.deviceLookupService.getDeviceIdBySerial(
        dto.deviceSerial,
      );

      // Validate packet
      const validation = await this.packetValidator.validatePacket(
        {
          deviceId,
          deviceSerial: dto.deviceSerial,
          sequenceNumber: dto.sequenceNumber,
          recordedAt: new Date(dto.recordedAt),
          receivedAt: new Date(),
          packetType: 'location',
        },
        dto,
      );

      if (!validation.valid) {
        throw new BadRequestException(
          `Packet validation failed: ${validation.errors.join(', ')}`,
        );
      }

      if (validation.warnings.length > 0) {
        this.logger.warn(
          `IMU data warnings for ${dto.deviceSerial}: ${validation.warnings.join(', ')}`,
        );
      }

      const recordedAt = validation.correctedTimestamp || new Date(dto.recordedAt);

      // Store raw sensor data
      const metric = this.locationMetricRepository.create({
        deviceId,
        recordedAt,
        xCoordinate: dto.xCoordinate ?? null,
        yCoordinate: dto.yCoordinate ?? null,
        zCoordinate: dto.zCoordinate ?? null,
        accuracyMeters: dto.accuracyMeters ?? null,
        locationMethod: dto.locationMethod ?? null,
        zoneId: dto.zoneId ?? null,
      });

      const savedMetric = await this.locationMetricRepository.save(metric);

      await this.publishMetricEvent(savedMetric, 'location', dto.deviceSerial);
    } catch (error) {
      this.logger.error(`Failed to ingest IMU data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Ingest device status (heartbeat) with validation.
   */
  async ingestDeviceStatus(dto: DeviceStatusDto): Promise<void> {
    try {
      const deviceId = await this.deviceLookupService.getDeviceIdBySerial(
        dto.deviceSerial,
      );

      // Validate packet
      const validation = await this.packetValidator.validatePacket(
        {
          deviceId,
          deviceSerial: dto.deviceSerial,
          sequenceNumber: dto.sequenceNumber,
          recordedAt: new Date(dto.recordedAt),
          receivedAt: new Date(),
          packetType: 'status',
        },
        dto,
      );

      if (!validation.valid) {
        throw new BadRequestException(
          `Packet validation failed: ${validation.errors.join(', ')}`,
        );
      }

      if (validation.warnings.length > 0) {
        this.logger.warn(
          `Device status warnings for ${dto.deviceSerial}: ${validation.warnings.join(', ')}`,
        );
      }

      const recordedAt = validation.correctedTimestamp || new Date(dto.recordedAt);

      await this.handleDeviceDataReceived(deviceId, dto.deviceSerial);

      let gatewayId: string | null = null;
      if (dto.gatewaySerial) {
        gatewayId =
          (await this.deviceLookupService.getGatewayIdBySerial(
            dto.gatewaySerial,
          )) ?? null;
      }

      // Store raw device status (heartbeat)
      const status = this.deviceStatusRepository.create({
        deviceId,
        gatewayId,
        recordedAt,
        connectionStatus: dto.connectionStatus,
        batteryLevel: dto.batteryLevel ?? null,
        signalStrength: dto.signalStrength ?? null,
        systemStatus: {
          ...(dto.systemStatus || {}),
          sequenceNumber: dto.sequenceNumber,
          validationWarnings: validation.warnings,
          sequenceStatus: validation.sequenceStatus,
        },
      });

      const savedStatus = await this.deviceStatusRepository.save(status);

      // Update streaming service and health monitor (heartbeat received)
      this.deviceStreamingService.updateLastDataReceived(deviceId);
      this.deviceHealthMonitor.updateLastSeen(deviceId);

      await this.publishMetricEvent(savedStatus, 'status', dto.deviceSerial);
    } catch (error) {
      this.logger.error(
        `Failed to ingest device status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Ingest batch of metrics with validation.
   */
  async ingestBatch(
    metrics: Array<PpgDataDto | TemperatureDataDto | ImuDataDto | DeviceStatusDto>,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    if (!metrics || metrics.length === 0) {
      return results;
    }

    // Process each metric individually with validation
    for (const metric of metrics) {
      try {
        if (!metric || !('deviceSerial' in metric)) {
          results.failed++;
          results.errors.push('Invalid metric format: missing deviceSerial');
          continue;
        }

        // Route to appropriate handler
        if ('heartRate' in metric || 'oxygenSaturation' in metric) {
          await this.ingestPpgData(metric as PpgDataDto);
          results.success++;
        } else if ('temperatureCelsius' in metric) {
          await this.ingestTemperatureData(metric as TemperatureDataDto);
          results.success++;
        } else if ('xCoordinate' in metric || 'yCoordinate' in metric || 'zCoordinate' in metric) {
          await this.ingestImuData(metric as ImuDataDto);
          results.success++;
        } else if ('connectionStatus' in metric) {
          await this.ingestDeviceStatus(metric as DeviceStatusDto);
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Unknown metric type for device ${metric.deviceSerial}`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Failed to ingest metric for ${metric.deviceSerial}: ${errorMessage}`);
        this.logger.error(
          `Batch ingestion error for ${metric.deviceSerial}: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return results;
  }

  /**
   * Publish metric event to event pipeline.
   * Note: AI analysis happens separately and stores results in ai_analyses table.
   */
  private async publishMetricEvent(
    metric: VitalMetric | LocationMetric | DeviceStatus,
    metricType: 'vital' | 'location' | 'status',
    deviceSerial: string,
  ): Promise<void> {
    try {
      // Get inmate device ID from streaming service if device is bound
      let inmateDeviceId: string | null = null;
      inmateDeviceId = this.deviceStreamingService.getInmateDeviceId(metric.deviceId);
      
      // Fallback to metric's inmateDeviceId if available (for backward compatibility)
      if (!inmateDeviceId && 'inmateDeviceId' in metric && metric.inmateDeviceId) {
        inmateDeviceId = metric.inmateDeviceId;
      }

      // Extract data based on metric type
      const data: any = {
        recordedAt: metric.recordedAt,
      };

      if (metricType === 'vital') {
        const vitalMetric = metric as VitalMetric;
        data.heartRate = vitalMetric.heartRate;
        data.temperatureCelsius = vitalMetric.temperatureCelsius;
        data.oxygenSaturation = vitalMetric.oxygenSaturation;
        data.bloodPressureSystolic = vitalMetric.bloodPressureSystolic;
        data.bloodPressureDiastolic = vitalMetric.bloodPressureDiastolic;
        data.batteryLevel = vitalMetric.batteryLevel;
        data.signalStrength = vitalMetric.signalStrength;
      } else if (metricType === 'status') {
        const statusMetric = metric as DeviceStatus;
        data.connectionStatus = statusMetric.connectionStatus;
        data.batteryLevel = statusMetric.batteryLevel;
        data.signalStrength = statusMetric.signalStrength;
      }

      // Publish to event pipeline (AI services will consume this separately)
      await this.eventPublisher.publishMetricEvent({
        type: 'metric.ingested' as const,
        metricId: metric.id,
        deviceId: metric.deviceId,
        inmateDeviceId,
        metricType,
        data,
      });

      // Emit WebSocket event for real-time updates
      if (metricType === 'vital') {
        try {
          this.realtimeEmitter.emitVitalMetric({
            deviceId: metric.deviceId,
            inmateDeviceId,
            metricId: metric.id,
            heartRate: data.heartRate ?? null,
            temperatureCelsius: data.temperatureCelsius ?? null,
            oxygenSaturation: data.oxygenSaturation ?? null,
            bloodPressureSystolic: data.bloodPressureSystolic ?? null,
            bloodPressureDiastolic: data.bloodPressureDiastolic ?? null,
            batteryLevel: data.batteryLevel ?? null,
            signalStrength: data.signalStrength ?? null,
            recordedAt: data.recordedAt.toISOString(),
          });
        } catch (error) {
          this.logger.warn(
            `Failed to emit WebSocket vital metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      } else if (metricType === 'status') {
        try {
          this.realtimeEmitter.emitDeviceStatus({
            deviceId: metric.deviceId,
            connectionStatus: data.connectionStatus || 'unknown',
            batteryLevel: data.batteryLevel ?? null,
            signalStrength: data.signalStrength ?? null,
            recordedAt: data.recordedAt.toISOString(),
          });
        } catch (error) {
          this.logger.warn(
            `Failed to emit WebSocket device status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } catch (error) {
      // Log error but don't fail ingestion
      this.logger.warn(
        `Failed to publish metric event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle device data received - check if bound and streaming, handle reconnection.
   */
  private async handleDeviceDataReceived(
    deviceId: string,
    deviceSerial: string,
  ): Promise<void> {
    try {
      // Check if device is actively streaming
      const isStreaming = this.deviceStreamingService.isStreaming(deviceId);

      if (!isStreaming) {
        // Device not streaming - check if it should be (has active assignment)
        // This handles reconnection scenario
        const streamInfo = this.deviceStreamingService.getStreamInfo(deviceId);
        const jailId = streamInfo?.jailId;
        if (jailId) {
          await this.deviceBindingService.handleReconnection(deviceId, jailId);
        }
      }
    } catch (error) {
      // Don't fail ingestion if binding check fails
      this.logger.warn(
        `Failed to check device binding status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
