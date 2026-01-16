import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { SecureBandService } from '../secureband.service';
import { SecureBandStatus } from '../entities/secureband.entity';

export interface DeviceAuthenticatedRequest extends Request {
  deviceUid?: string;
  deviceJailId?: string;
  deviceId?: string;
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private readonly secureBandService: SecureBandService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeviceAuthenticatedRequest>();
    
    // Extract device credentials from headers
    const deviceUid = request.headers['x-device-uid'] as string;
    const authToken = request.headers['x-device-token'] as string;
    const nonce = request.headers['x-device-nonce'] as string;

    if (!deviceUid || !authToken || !nonce) {
      throw new UnauthorizedException(
        'Device authentication required. Missing device credentials.',
      );
    }

    // Validate device authentication
    const validation = await this.secureBandService.validateDeviceAuth(
      deviceUid,
      authToken,
      nonce,
    );

    if (!validation.valid) {
      throw new UnauthorizedException(
        'Invalid device credentials or device is not registered/active.',
      );
    }

    // Attach device info to request
    request.deviceUid = deviceUid;
    request.deviceJailId = validation.jailId;
    request.deviceId = validation.deviceId;

    return true;
  }
}
