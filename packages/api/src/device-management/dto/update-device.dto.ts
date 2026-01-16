/** DTO for updating a SecureBand device. */

import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum DeviceStatus {
  INVENTORY = 'inventory',
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
  REVOKED = 'revoked',
}

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  firmwareVersion?: string;

  @IsString()
  @IsOptional()
  hardwareVersion?: string;

  @IsEnum(DeviceStatus)
  @IsOptional()
  status?: DeviceStatus;

  @IsDateString()
  @IsOptional()
  deployedDate?: string;
}
