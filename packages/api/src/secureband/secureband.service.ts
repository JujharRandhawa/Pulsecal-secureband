import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { SecureBand, SecureBandStatus } from './entities/secureband.entity';
import { AddSecureBandDto } from './dto/add-secureband.dto';
import { RemoveSecureBandDto } from './dto/remove-secureband.dto';
import { SecureBandResponseDto, SecureBandAuthTokenDto } from './dto/secureband-response.dto';
import { AuditService } from '../audit/audit.service';
import { ForensicService } from '../forensic/forensic.service';

@Injectable()
export class SecureBandService {
  private readonly TOKEN_EXPIRY_HOURS = 24 * 365; // 1 year
  private readonly NONCE_SEED_LENGTH = 32;

  constructor(
    @InjectRepository(SecureBand)
    private readonly secureBandRepository: Repository<SecureBand>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly forensicService: ForensicService,
  ) {}

  /**
   * Add a new SecureBand device
   * State: LOCKED -> ACTIVE
   */
  async addSecureBand(
    deviceUid: string,
    jailId: string,
    addedBy: string,
    dto: AddSecureBandDto,
  ): Promise<SecureBandAuthTokenDto> {
    // Check if forensic mode is active (prevent writes)
    const writeAllowed = await this.forensicService.isWriteAllowed();
    if (!writeAllowed) {
      throw new ForbiddenException('Cannot add devices in forensic mode');
    }

    // Check if device already exists and is active/locked
    const existing = await this.secureBandRepository.findOne({
      where: { deviceUid },
    });

    if (existing) {
      if (existing.status === SecureBandStatus.ACTIVE || existing.status === SecureBandStatus.LOCKED) {
        throw new ConflictException(
          `Device ${deviceUid} is already registered and active in jail ${existing.jailId}`,
        );
      }
      if (existing.status === SecureBandStatus.REVOKED) {
        throw new ConflictException(
          `Device ${deviceUid} has been revoked and cannot be re-registered`,
        );
      }
    }

    // Generate authentication token
    const token = this.generateAuthToken(deviceUid, jailId);
    const tokenHash = this.hashToken(token);
    const tokenExpiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const nonceSeed = randomBytes(this.NONCE_SEED_LENGTH).toString('hex');

    // Create or update device
    let secureBand: SecureBand;
    if (existing) {
      // Reactivate revoked device (new registration)
      secureBand = existing;
      secureBand.jailId = jailId;
      secureBand.status = SecureBandStatus.ACTIVE;
      secureBand.boundAt = new Date();
      secureBand.firmwareVersion = dto.firmwareVersion;
      secureBand.publicKey = dto.publicKey;
      secureBand.addedBy = addedBy;
      secureBand.addedAt = new Date();
      secureBand.authTokenHash = tokenHash;
      secureBand.tokenIssuedAt = new Date();
      secureBand.tokenExpiresAt = tokenExpiresAt;
      secureBand.nonceSeed = nonceSeed;
      secureBand.removedBy = null;
      secureBand.removedAt = null;
      secureBand.removalReason = null;
    } else {
      secureBand = this.secureBandRepository.create({
        deviceUid,
        jailId,
        status: SecureBandStatus.ACTIVE,
        boundAt: new Date(),
        firmwareVersion: dto.firmwareVersion,
        publicKey: dto.publicKey,
        addedBy,
        addedAt: new Date(),
        authTokenHash: tokenHash,
        tokenIssuedAt: new Date(),
        tokenExpiresAt,
        nonceSeed,
      });
    }

    await this.secureBandRepository.save(secureBand);

    // Log audit event
    await this.auditService.logCriticalAction(
      {
        action: 'secureband_added',
        resourceType: 'secureband',
        resourceId: secureBand.id,
        newValues: {
          deviceUid,
          jailId,
          status: SecureBandStatus.ACTIVE,
        },
        reason: `SecureBand ${deviceUid} added to jail`,
      },
      {} as any, // Request object - will be provided by controller
      jailId,
    );

    return {
      deviceUid: secureBand.deviceUid,
      token,
      tokenExpiresAt: secureBand.tokenExpiresAt!,
      nonceSeed: secureBand.nonceSeed!,
      publicKey: process.env.SERVER_PUBLIC_KEY, // Server's public key for mutual auth
    };
  }

  /**
   * Remove/Revoke a SecureBand device
   * State: ACTIVE -> REVOKED
   */
  async removeSecureBand(
    deviceUid: string,
    jailId: string,
    removedBy: string,
    dto: RemoveSecureBandDto,
  ): Promise<SecureBandResponseDto> {
    // Check if forensic mode is active
    const writeAllowed = await this.forensicService.isWriteAllowed();
    if (!writeAllowed) {
      throw new ForbiddenException('Cannot remove devices in forensic mode');
    }

    const secureBand = await this.secureBandRepository.findOne({
      where: { deviceUid, jailId },
      relations: ['jail'],
    });

    if (!secureBand) {
      throw new NotFoundException(`SecureBand ${deviceUid} not found in this jail`);
    }

    if (secureBand.status === SecureBandStatus.REVOKED) {
      throw new BadRequestException(`SecureBand ${deviceUid} is already revoked`);
    }

    // Revoke device
    secureBand.status = SecureBandStatus.REVOKED;
    secureBand.removedBy = removedBy;
    secureBand.removedAt = new Date();
    secureBand.removalReason = dto.reason;
    secureBand.authTokenHash = null; // Invalidate token
    secureBand.tokenExpiresAt = new Date(); // Expire immediately

    await this.secureBandRepository.save(secureBand);

    // Log audit event (async, don't wait)
    this.auditService.logCriticalAction(
      {
        action: 'secureband_removed',
        resourceType: 'secureband',
        resourceId: secureBand.id,
        oldValues: {
          status: SecureBandStatus.ACTIVE,
        },
        newValues: {
          status: SecureBandStatus.REVOKED,
          removalReason: dto.reason,
        },
        reason: `SecureBand ${deviceUid} revoked: ${dto.reason}`,
      },
      {} as any,
      jailId,
    ).catch((error) => {
      console.error('Failed to log audit event:', error);
    });

    return this.toResponseDto(secureBand);
  }

  /**
   * Get SecureBand by device UID
   */
  async getSecureBand(deviceUid: string, jailId: string): Promise<SecureBandResponseDto> {
    const secureBand = await this.secureBandRepository.findOne({
      where: { deviceUid, jailId },
      relations: ['jail'],
    });

    if (!secureBand) {
      throw new NotFoundException(`SecureBand ${deviceUid} not found`);
    }

    return this.toResponseDto(secureBand);
  }

  /**
   * List all SecureBands for a jail
   */
  async listSecureBands(jailId: string, status?: SecureBandStatus): Promise<SecureBandResponseDto[]> {
    const where: any = { jailId };
    if (status) {
      where.status = status;
    }

    const secureBands = await this.secureBandRepository.find({
      where,
      relations: ['jail'],
      order: { createdAt: 'DESC' },
    });

    return secureBands.map((sb) => this.toResponseDto(sb));
  }

  /**
   * Update device last seen timestamp
   */
  async updateLastSeen(deviceUid: string): Promise<void> {
    await this.secureBandRepository.update(
      { deviceUid },
      { lastSeen: new Date() },
    );
  }

  /**
   * Validate device authentication
   */
  async validateDeviceAuth(
    deviceUid: string,
    token: string,
    nonce: string,
  ): Promise<{ valid: boolean; jailId?: string; deviceId?: string }> {
    const secureBand = await this.secureBandRepository.findOne({
      where: { deviceUid },
    });

    if (!secureBand) {
      return { valid: false };
    }

    if (secureBand.status !== SecureBandStatus.ACTIVE) {
      return { valid: false };
    }

    // Check token expiration
    if (secureBand.tokenExpiresAt && secureBand.tokenExpiresAt < new Date()) {
      return { valid: false };
    }

    // Validate token hash
    const tokenHash = this.hashToken(token);
    if (secureBand.authTokenHash !== tokenHash) {
      return { valid: false };
    }

    // Validate nonce (replay attack protection)
    // In production, implement proper nonce validation
    // For now, basic check
    if (!this.validateNonce(nonce, secureBand.nonceSeed!)) {
      return { valid: false };
    }

    // Update last seen
    secureBand.lastSeen = new Date();
    await this.secureBandRepository.save(secureBand);

    return {
      valid: true,
      jailId: secureBand.jailId,
      deviceId: secureBand.id,
    };
  }

  /**
   * Generate authentication token
   */
  private generateAuthToken(deviceUid: string, jailId: string): string {
    const secret = process.env.DEVICE_AUTH_SECRET || 'CHANGE_ME_IN_PRODUCTION';
    const timestamp = Date.now();
    const random = randomBytes(16).toString('hex');

    const tokenData = `${deviceUid}:${jailId}:${timestamp}:${random}:${secret}`;
    return createHash('sha256').update(tokenData).digest('base64');
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate nonce (simplified - implement proper nonce validation in production)
   */
  private validateNonce(nonce: string, seed: string): boolean {
    // In production, implement proper nonce validation with timestamp checking
    // For now, basic validation
    return nonce && seed && nonce.length > 0;
  }

  /**
   * Convert entity to response DTO
   */
  private toResponseDto(secureBand: SecureBand): SecureBandResponseDto {
    return {
      id: secureBand.id,
      deviceUid: secureBand.deviceUid,
      jailId: secureBand.jailId,
      jailName: secureBand.jail?.name,
      status: secureBand.status,
      boundAt: secureBand.boundAt,
      lastSeen: secureBand.lastSeen,
      firmwareVersion: secureBand.firmwareVersion,
      addedAt: secureBand.addedAt,
      addedBy: secureBand.addedBy,
      removedAt: secureBand.removedAt,
      removedBy: secureBand.removedBy,
      removalReason: secureBand.removalReason,
      createdAt: secureBand.createdAt,
      updatedAt: secureBand.updatedAt,
    };
  }
}
