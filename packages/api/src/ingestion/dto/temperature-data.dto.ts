import { IsString, IsNumber, IsDateString, IsOptional, Min, Max, IsObject } from 'class-validator';

export class TemperatureDataDto {
  @IsString()
  deviceSerial: string;

  @IsDateString()
  recordedAt: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sequenceNumber?: number; // Packet sequence number for missing/delayed detection

  @IsNumber()
  @Min(30.0)
  @Max(45.0)
  temperatureCelsius: number;

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
