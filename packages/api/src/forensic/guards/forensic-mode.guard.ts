import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ForensicService } from '../forensic.service';

@Injectable()
export class ForensicModeGuard implements CanActivate {
  constructor(private readonly forensicService: ForensicService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only block write operations (POST, PUT, PATCH, DELETE)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      await this.forensicService.enforceReadOnly();
    }

    return true;
  }
}
