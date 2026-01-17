import { IsString, IsNumber, IsDateString, IsOptional, IsObject, Min } from 'class-validator';

export class ImuDataDto {
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
  xCoordinate?: number;

  @IsOptional()
  @IsNumber()
  yCoordinate?: number;

  @IsOptional()
  @IsNumber()
  zCoordinate?: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  locationMethod?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsObject()
  additionalMetrics?: Record<string, any>;
}
