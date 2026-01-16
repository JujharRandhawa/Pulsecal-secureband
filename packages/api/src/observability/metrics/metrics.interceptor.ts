/** HTTP metrics interceptor. */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const method = request.method;
    const route = request.route?.path || request.path;

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = response.statusCode;

        this.metricsService.httpRequestDuration.observe(
          { method, route, status_code: statusCode.toString() },
          duration,
        );

        this.metricsService.httpRequestTotal.inc({
          method,
          route,
          status_code: statusCode.toString(),
        });
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = error.status || 500;

        this.metricsService.httpRequestDuration.observe(
          { method, route, status_code: statusCode.toString() },
          duration,
        );

        this.metricsService.httpRequestTotal.inc({
          method,
          route,
          status_code: statusCode.toString(),
        });

        this.metricsService.httpRequestErrors.inc({
          method,
          route,
          error_type: error.constructor.name || 'UnknownError',
        });

        throw error;
      }),
    );
  }
}
