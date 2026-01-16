import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from '../audit.service';
import { AUDIT_KEY, AUDIT_CRITICAL_KEY } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();

    // Check for audit decorators
    const auditOptions = this.reflector.get(AUDIT_KEY, handler);
    const criticalOptions = this.reflector.get(AUDIT_CRITICAL_KEY, handler);
    const options = criticalOptions || auditOptions;

    if (!options) {
      return next.handle();
    }

    // Get jail ID from request (set by AuthGuard)
    const jailId = (request as any).jailId;

    // Capture request body before processing
    const requestBody = { ...request.body };

    return next.handle().pipe(
      tap({
        next: async (response) => {
          // Log successful action
          await this.auditService.logAction(
            {
              action: options.action,
              resourceType: options.resourceType,
              resourceId: this.extractResourceId(request, response),
              newValues: this.sanitizeResponse(response),
              severity: options.severity || 'info',
              approvalRequired: options.approvalRequired || false,
            },
            request,
            jailId,
          );
        },
        error: async (error) => {
          // Log failed action
          await this.auditService.logAction(
            {
              action: options.action,
              resourceType: options.resourceType,
              resourceId: this.extractResourceId(request),
              newValues: { error: error.message },
              severity: 'warning',
            },
            request,
            jailId,
          );
        },
      }),
    );
  }

  private extractResourceId(request: Request, response?: any): string | undefined {
    // Try to get resource ID from various sources
    return (
      request.params.id ||
      request.params.deviceId ||
      request.params.inmateId ||
      request.body?.id ||
      response?.id ||
      undefined
    );
  }

  private sanitizeResponse(response: any): any {
    // Remove sensitive data from response
    if (!response) return response;

    const sanitized = { ...response };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
