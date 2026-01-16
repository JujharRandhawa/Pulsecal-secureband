import { SecureBandStatus } from '../entities/secureband.entity';

export class SecureBandResponseDto {
  id!: string;
  deviceUid!: string;
  jailId!: string;
  jailName?: string;
  status!: SecureBandStatus;
  boundAt?: Date;
  lastSeen?: Date;
  firmwareVersion?: string;
  addedAt?: Date;
  addedBy?: string;
  removedAt?: Date;
  removedBy?: string;
  removalReason?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class SecureBandAuthTokenDto {
  deviceUid!: string;
  token!: string;
  tokenExpiresAt!: Date;
  nonceSeed!: string;
  publicKey?: string; // Server public key for mutual authentication
}
