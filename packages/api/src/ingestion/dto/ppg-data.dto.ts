import { IsString, IsNumber, IsDateString, IsOptional, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class PpgDataDto {
  @IsString()
  deviceSerial: string;

  @IsDateString()
  recordedAt: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sequenceNumber?: number; // Packet sequence number for missing/delayed detection

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(250)
  heartRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  oxygenSaturation?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  bloodPressureSystolic?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(150)
  bloodPressureDiastolic?: number;

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
  additionalMetrics?: Record<string, any>;
}
