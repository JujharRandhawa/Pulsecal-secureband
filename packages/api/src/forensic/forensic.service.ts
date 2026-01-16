import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ForensicMode } from './entities/forensic-mode.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ForensicService {
  constructor(
    @InjectRepository(ForensicMode)
    private readonly forensicModeRepository: Repository<ForensicMode>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Enable forensic mode (read-only)
   */
  async enableForensicMode(
    enabledBy: string,
    reason: string,
    readOnly: boolean = true,
  ): Promise<ForensicMode> {
    // Check if already enabled
    const existing = await this.forensicModeRepository.findOne({
      where: { enabled: true },
    });

    if (existing) {
      throw new ForbiddenException('Forensic mode is already enabled');
    }

    // Enable via database function (ensures atomic operation)
    const result = await this.dataSource.query(
      `SELECT enable_forensic_mode($1, $2, $3) as id`,
      [enabledBy, reason, readOnly],
    );

    const forensicMode = await this.forensicModeRepository.findOne({
      where: { id: result[0].id },
    });

    return forensicMode!;
  }

  /**
   * Disable forensic mode
   */
  async disableForensicMode(
    disabledBy: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.query(
      `SELECT disable_forensic_mode($1, $2)`,
      [disabledBy, reason],
    );
  }

  /**
   * Check if forensic mode is active
   */
  async isForensicModeActive(): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT is_forensic_mode_active() as active`,
    );
    return result[0].active;
  }

  /**
   * Get current forensic mode status
   */
  async getForensicModeStatus(): Promise<ForensicMode | null> {
    return this.forensicModeRepository.findOne({
      where: { enabled: true },
    });
  }

  /**
   * Get forensic mode history
   */
  async getForensicModeHistory(): Promise<ForensicMode[]> {
    return this.forensicModeRepository.find({
      order: { enabledAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Check if write operations are allowed
   */
  async isWriteAllowed(): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT is_write_allowed() as allowed`,
    );
    return result[0].allowed;
  }

  /**
   * Enforce read-only mode (throws exception if writes not allowed)
   */
  async enforceReadOnly(): Promise<void> {
    const allowed = await this.isWriteAllowed();
    if (!allowed) {
      const status = await this.getForensicModeStatus();
      throw new ForbiddenException(
        `Write operations are disabled. Forensic mode is active (read-only). Reason: ${status?.enabledReason}`,
      );
    }
  }
}
