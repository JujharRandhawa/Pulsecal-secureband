import { IsNotEmpty, IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class AddSecureBandDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Device UID must contain only alphanumeric characters, hyphens, and underscores',
  })
  deviceUid!: string;

  @IsString()
  @MaxLength(50)
  firmwareVersion?: string;

  @IsString()
  publicKey?: string; // Device public key for mutual authentication
}
