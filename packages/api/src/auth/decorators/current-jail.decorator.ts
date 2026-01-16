import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/auth.guard';

/**
 * Decorator to extract current jail information from request
 * Usage: @CurrentJail() jail: { id: string, name: string }
 */
export const CurrentJail = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return {
      id: request.jailId,
      name: request.jailName,
      session: request.session,
    };
  },
);
