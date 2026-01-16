import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RemoveSecureBandDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  reason!: string; // Required reason for removal/revocation
}
