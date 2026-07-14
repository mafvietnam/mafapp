import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // RED TEAM FIX #15: trust the first hop (the Cloudflare Tunnel connector) so
  // Express derives req.ip from X-Forwarded-For correctly. The throttler guard
  // (see app.module.ts CfConnectingIpThrottlerGuard) primarily keys on the
  // CF-Connecting-IP header, but req.ip is still the fallback for non-Cloudflare
  // (local/dev) traffic — this must be set for that fallback to be meaningful.
  app.set('trust proxy', 1);

  // CORS — allow configured frontend origin only
  const corsOrigin = process.env.CORS_ORIGIN || 'https://app.maf.run';
  const origins =
    process.env.NODE_ENV === 'production'
      ? [corsOrigin]
      : [corsOrigin, 'http://localhost:5173'];
  app.enableCors({ origin: origins, credentials: true });

  // Cookie parser for httpOnly JWT cookies
  app.use(cookieParser());

  // Global validation pipe with implicit conversion (frontend sends strings for numbers)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API running on port ${port}`, 'Bootstrap');
}
bootstrap();
