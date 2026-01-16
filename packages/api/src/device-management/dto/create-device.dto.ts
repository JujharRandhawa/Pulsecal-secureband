/** DTO for creating a new SecureBand device. */

import { IsString, IsNotEmpty, IsOptional, Matches, IsDateString } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
    message: 'MAC address must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX',
  })
  macAddress: string;

  @IsString()
  @IsOptional()
  firmwareVersion?: string;

  @IsString()
  @IsOptional()
  hardwareVersion?: string;

  @IsDateString()
  @IsOptional()
  manufacturedDate?: string;

  @IsDateString()
  @IsOptional()
  deployedDate?: string;
}
