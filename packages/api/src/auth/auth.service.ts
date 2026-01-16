import { Injectable, UnauthorizedException, TooManyRequestsException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { Jail } from './entities/jail.entity';
import { Session } from './entities/session.entity';
import { LoginAttempt } from './entities/login-attempt.entity';

@Injectable()
export class AuthService {
  private readonly SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectRepository(Jail)
    private readonly jailRepository: Repository<Jail>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Authenticate a jail and create a session
   */
  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<LoginResponseDto> {
    // Check rate limit
    await this.checkRateLimit(loginDto.jailName, ipAddress);

    // Find jail by name
    const jail = await this.jailRepository.findOne({
      where: { name: loginDto.jailName, isActive: true },
    });

    if (!jail) {
      await this.recordLoginAttempt(loginDto.jailName, ipAddress, false, 'Jail not found');
      throw new UnauthorizedException('Invalid jail name or password');
    }

    // Verify password
    const isValidPassword = await argon2.verify(jail.passwordHash, loginDto.password);

    if (!isValidPassword) {
      await this.recordLoginAttempt(loginDto.jailName, ipAddress, false, 'Invalid password');
      throw new UnauthorizedException('Invalid jail name or password');
    }

    // Invalidate any existing active sessions for this jail (one active session per jail)
    await this.sessionRepository
      .createQueryBuilder()
      .delete()
      .where('jail_id = :jailId', { jailId: jail.id })
      .andWhere('expires_at > NOW()')
      .execute();

    // Create new session
    const token = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION_MS);

    const session = this.sessionRepository.create({
      jailId: jail.id,
      token,
      ipAddress,
      userAgent,
      expiresAt,
    });

    await this.sessionRepository.save(session);

    // Record successful login attempt
    await this.recordLoginAttempt(loginDto.jailName, ipAddress, true);

    return {
      token,
      expiresAt,
      jailName: jail.name,
    };
  }

  /**
   * Logout by invalidating the session
   */
  async logout(token: string): Promise<void> {
    await this.sessionRepository.delete({ token });
  }

  /**
   * Validate a session token
   */
  async validateSession(token: string): Promise<Session | null> {
    const session = await this.sessionRepository.findOne({
      where: { token },
      relations: ['jail'],
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await this.sessionRepository.delete({ id: session.id });
      return null;
    }

    // Check if jail is still active
    if (!session.jail.isActive) {
      await this.sessionRepository.delete({ id: session.id });
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
    await this.sessionRepository.save(session);

    return session;
  }

  /**
   * Change password for a jail
   */
  async changePassword(
    jailId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const jail = await this.jailRepository.findOne({ where: { id: jailId } });

    if (!jail) {
      throw new UnauthorizedException('Jail not found');
    }

    // Verify current password
    const isValidPassword = await argon2.verify(jail.passwordHash, currentPassword);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid current password');
    }

    // Hash new password
    const newPasswordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Update password and invalidate all sessions
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Jail, { id: jailId }, {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      });

      // Invalidate all sessions for this jail
      await manager.delete(Session, { jailId });
    });
  }

  /**
   * Check rate limit for login attempts
   */
  private async checkRateLimit(jailName: string, ipAddress: string): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.RATE_LIMIT_WINDOW_MS);

    const attemptCount = await this.loginAttemptRepository
      .createQueryBuilder('attempt')
      .where('attempt.jailName = :jailName', { jailName })
      .andWhere('attempt.ipAddress = :ipAddress', { ipAddress })
      .andWhere('attempt.success = :success', { success: false })
      .andWhere('attempt.attemptedAt >= :cutoffTime', { cutoffTime })
      .getCount();

    if (attemptCount >= this.MAX_LOGIN_ATTEMPTS) {
      throw new TooManyRequestsException(
        'Too many login attempts. Please try again later.',
      );
    }
  }

  /**
   * Record a login attempt
   */
  private async recordLoginAttempt(
    jailName: string,
    ipAddress: string,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    const attempt = this.loginAttemptRepository.create({
      jailName,
      ipAddress,
      success,
      failureReason: success ? undefined : failureReason,
    });

    await this.loginAttemptRepository.save(attempt);

    // Cleanup old attempts (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await this.loginAttemptRepository
      .createQueryBuilder()
      .delete()
      .where('attempted_at < :oneHourAgo', { oneHourAgo })
      .execute();
  }

  /**
   * Invalidate all sessions for a jail
   */
  private async invalidateJailSessions(jailId: string): Promise<void> {
    await this.sessionRepository.delete({ jailId });
  }

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }
}
