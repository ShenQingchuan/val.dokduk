import type { NestExpressApplication } from '@nestjs/platform-express'
import path from 'node:path'
import process from 'node:process'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module.js'
import 'dotenv/config'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })

  // Get logger
  const logger = app.get(Logger)
  app.useLogger(logger)

  // Configure CORS - TODO: Update based on your environment variables
  app.enableCors({
    origin: true,
    credentials: true,
  })

  // Serve static files in production - TODO: Update based on your environment variables
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    const publicPath = path.join(import.meta.dirname, 'public')
    app.useStaticAssets(publicPath)
  }

  // Set global prefix for API - TODO: Update based on your environment variables
  app.setGlobalPrefix('api')

  // Start server - TODO: Update based on your environment variables
  const host = process.env.HOST || '0.0.0.0'
  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  await app.listen(port, host)
  logger.log(`Server is listening on http://${host}:${port}`)
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
}

bootstrap()
