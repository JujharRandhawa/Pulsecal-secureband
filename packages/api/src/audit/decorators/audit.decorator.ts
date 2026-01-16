import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';
export const AUDIT_CRITICAL_KEY = 'audit_critical';

export interface AuditOptions {
  action: string;
  resourceType: string;
  severity?: 'info' | 'warning' | 'critical';
  approvalRequired?: boolean;
}

/**
 * Decorator to automatically audit controller actions
 */
export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_KEY, options);

/**
 * Decorator for critical actions requiring approval
 */
export const AuditCritical = (options: Omit<AuditOptions, 'severity' | 'approvalRequired'>) =>
  SetMetadata(AUDIT_CRITICAL_KEY, {
    ...options,
    severity: 'critical',
    approvalRequired: true,
  });
