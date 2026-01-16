import { IsString, IsNumber, IsDateString, IsOptional, IsIn, Min, Max, IsObject } from 'class-validator';

export class DeviceStatusDto {
  @IsString()
  deviceSerial: string;

  @IsDateString()
  recordedAt: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sequenceNumber?: number; // Packet sequence number for missing/delayed detection

  @IsString()
  @IsIn(['connected', 'disconnected', 'error', 'maintenance'])
  connectionStatus: string;

  @IsOptional()
  @IsString()
  gatewaySerial?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @IsOptional()
  @IsNumber()
  signalStrength?: number;

  @IsOptional()
  @IsObject()
  systemStatus?: Record<string, any>;
}
