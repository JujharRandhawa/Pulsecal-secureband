import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { Request } from 'express';

export interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  severity?: 'info' | 'warning' | 'critical';
  approvalRequired?: boolean;
  metadata?: any;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditLogRepository: Repository<AdminAuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Log an admin action with tamper resistance
   */
  async logAction(
    entry: AuditLogEntry,
    request: Request,
    jailId?: string,
  ): Promise<AdminAuditLog> {
    const ipAddress = this.getClientIp(request);
    const userAgent = request.headers['user-agent'] || '';

    const auditEntry = this.auditLogRepository.create({
      jailId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      ipAddress,
      userAgent,
      requestMethod: request.method,
      requestPath: request.path,
      requestBody: this.sanitizeRequestBody(request.body),
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      reason: entry.reason,
      approvalRequired: entry.approvalRequired || false,
      severity: entry.severity || 'info',
      metadata: entry.metadata,
    });

    // Hash chain is calculated by database trigger
    return await this.auditLogRepository.save(auditEntry);
  }

  /**
   * Log critical action requiring approval
   */
  async logCriticalAction(
    entry: AuditLogEntry,
    request: Request,
    jailId?: string,
  ): Promise<AdminAuditLog> {
    return this.logAction(
      {
        ...entry,
        severity: 'critical',
        approvalRequired: true,
      },
      request,
      jailId,
    );
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(
    startTime?: Date,
    endTime?: Date,
  ): Promise<{ valid: boolean; invalidEntries: any[] }> {
    const start = startTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endTime || new Date();

    const result = await this.dataSource.query(
      `SELECT * FROM verify_audit_integrity($1, $2) WHERE is_valid = false`,
      [start, end],
    );

    return {
      valid: result.length === 0,
      invalidEntries: result,
    };
  }

  /**
   * Get audit log entries
   */
  async getAuditLogs(
    filters: {
      jailId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      severity?: string;
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    },
  ): Promise<AdminAuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters.jailId) {
      query.andWhere('audit.jailId = :jailId', { jailId: filters.jailId });
    }

    if (filters.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters.resourceType) {
      query.andWhere('audit.resourceType = :resourceType', {
        resourceType: filters.resourceType,
      });
    }

    if (filters.resourceId) {
      query.andWhere('audit.resourceId = :resourceId', {
        resourceId: filters.resourceId,
      });
    }

    if (filters.severity) {
      query.andWhere('audit.severity = :severity', { severity: filters.severity });
    }

    if (filters.startTime) {
      query.andWhere('audit.timestamp >= :startTime', {
        startTime: filters.startTime,
      });
    }

    if (filters.endTime) {
      query.andWhere('audit.timestamp <= :endTime', { endTime: filters.endTime });
    }

    query.orderBy('audit.timestamp', 'DESC');

    if (filters.limit) {
      query.limit(filters.limit);
    }

    return query.getMany();
  }

  /**
   * Get critical actions requiring attention
   */
  async getCriticalActions(limit: number = 50): Promise<AdminAuditLog[]> {
    return this.auditLogRepository.find({
      where: [
        { severity: 'critical' },
        { approvalRequired: true },
      ],
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  private sanitizeRequestBody(body: any): any {
    // Remove sensitive fields from request body
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
