import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PpgDataDto } from './ppg-data.dto';
import { TemperatureDataDto } from './temperature-data.dto';
import { ImuDataDto } from './imu-data.dto';
import { DeviceStatusDto } from './device-status.dto';

export class BatchIngestionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000) // Limit batch size for performance
  @ValidateNested({ each: true })
  @Type(() => Object) // Will be validated based on type field
  metrics: Array<PpgDataDto | TemperatureDataDto | ImuDataDto | DeviceStatusDto>;
}
