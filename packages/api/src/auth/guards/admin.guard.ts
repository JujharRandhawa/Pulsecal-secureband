/**
 * Admin Guard - Enforces jail-based admin authentication.
 * 
 * In this system, a "jail" IS the admin. Each jail facility has its own
 * authentication credentials and can only manage devices within their facility.
 * 
 * This guard ensures that:
 * 1. The request has a valid authenticated jail session
 * 2. The jail is active (not disabled)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Session } from '../entities/session.entity';

export interface AdminAuthenticatedRequest extends Request {
  session?: Session;
  jailId?: string;
  jailName?: string;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException(
        'Admin authentication required. No session token provided.',
      );
    }

    const session = await this.authService.validateSession(token);

    if (!session) {
      throw new UnauthorizedException(
        'Invalid or expired admin session. Please log in again.',
      );
    }

    // Check if jail is active
    if (!session.jail || !session.jail.isActive) {
      throw new ForbiddenException(
        'Access denied. Jail facility is currently deactivated.',
      );
    }

    // Attach session info to request for downstream use
    request.session = session;
    request.jailId = session.jailId;
    request.jailName = session.jail.name;

    return true;
  }

  private extractTokenFromRequest(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}
