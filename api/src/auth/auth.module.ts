import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { GoogleStrategy } from './google.strategy.js';
import { UserModule } from '../user/user.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKey = Buffer.from(
          config.get<string>('JWT_PRIVATE_KEY', ''),
          'base64',
        ).toString('utf-8');
        const publicKey = Buffer.from(
          config.get<string>('JWT_PUBLIC_KEY', ''),
          'base64',
        ).toString('utf-8');
        return {
          privateKey,
          publicKey,
          signOptions: { algorithm: 'RS256', expiresIn: '15m' },
        };
      },
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
