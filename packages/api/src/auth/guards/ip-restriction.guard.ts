import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpRestrictionGuard implements CanActivate {
  private readonly allowedNetworks: string[];

  constructor(private readonly configService: ConfigService) {
    // Get allowed IP ranges from config (default: private IP ranges)
    const allowedRanges = this.configService.get<string>(
      'AUTH_ALLOWED_IP_RANGES',
      '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1/32',
    );
    this.allowedNetworks = allowedRanges.split(',').map((range) => range.trim());
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ipAddress = this.getClientIp(request);

    if (!this.isIpAllowed(ipAddress)) {
      throw new ForbiddenException('Access denied: IP address not allowed');
    }

    return true;
  }

  private getClientIp(request: any): string {
    return (
      request.ip ||
      request.connection?.remoteAddress ||
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private isIpAllowed(ip: string): boolean {
    if (ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
      return true; // Allow localhost
    }

    // Check if IP matches any allowed network
    for (const network of this.allowedNetworks) {
      if (this.isIpInNetwork(ip, network)) {
        return true;
      }
    }

    return false;
  }

  private isIpInNetwork(ip: string, network: string): boolean {
    if (!network.includes('/')) {
      // Single IP address
      return ip === network;
    }

    const [networkIp, prefixLength] = network.split('/');
    const prefix = parseInt(prefixLength, 10);

    // Convert IPs to numbers
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(networkIp);

    if (isNaN(ipNum) || isNaN(networkNum)) {
      return false;
    }

    // Calculate network mask
    const mask = (0xffffffff << (32 - prefix)) >>> 0;

    // Check if IP is in network
    return (ipNum & mask) === (networkNum & mask);
  }

  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return NaN;
    }

    return (
      parseInt(parts[0], 10) * 256 * 256 * 256 +
      parseInt(parts[1], 10) * 256 * 256 +
      parseInt(parts[2], 10) * 256 +
      parseInt(parts[3], 10)
    );
  }
}
