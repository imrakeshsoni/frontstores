import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) return true;

  const allowed =
    /^https?:\/\/(frontstores\.com|.*\.frontstores\.com|.*\.run\.app|localhost|127\.0\.0\.1|(\[[0-9a-fA-F:]+\]))(:\d+)?$/;
  return allowed.test(origin);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('AuthService');

  app.use(helmet());

  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('v1');

  const port = Number(process.env.AUTH_SERVICE_PORT ?? 3001);
  await app.listen(port);
  logger.log(`Auth Service running on port ${port}`);
}

bootstrap();
