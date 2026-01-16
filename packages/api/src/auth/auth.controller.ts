import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthGuard } from './guards/auth.guard';
import { IpRestrictionGuard } from './guards/ip-restriction.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(IpRestrictionGuard)
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResponseDto> {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async logout(@Request() req: any): Promise<void> {
    const token = this.extractTokenFromRequest(req);
    await this.authService.logout(token);
  }

  private extractTokenFromRequest(req: any): string {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    throw new Error('No token found in request');
  }
}
