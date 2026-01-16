import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { IpRestrictionGuard } from './guards/ip-restriction.guard';
import { Jail } from './entities/jail.entity';
import { Session } from './entities/session.entity';
import { LoginAttempt } from './entities/login-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Jail, Session, LoginAttempt]),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard, IpRestrictionGuard],
  exports: [AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
