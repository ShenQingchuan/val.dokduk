import type { NestExpressApplication } from '@nestjs/platform-express'
import fs from 'node:fs'
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

  // Set global prefix for API - TODO: Update based on your environment variables
  app.setGlobalPrefix('api')

  // Serve static files in production - TODO: Update based on your environment variables
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    const publicPath = path.join(import.meta.dirname, 'public')
    const indexPath = path.join(publicPath, 'index.html')

    app.useStaticAssets(publicPath)

    // SPA fallback: serve index.html for non-API routes (Express 5 requires named wildcards)
    const expressApp = app.getHttpAdapter().getInstance()
    expressApp.get('/{*splat}', (req: { path: string }, res: { sendFile: (path: string) => void }, next: () => void) => {
      // Skip API routes
      if (req.path.startsWith('/api')) {
        return next()
      }
      // Skip requests for files with extensions (static assets)
      if (path.extname(req.path)) {
        return next()
      }
      // Serve index.html for SPA routes
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath)
      }
      return next()
    })
  }

  // Start server - TODO: Update based on your environment variables
  const host = process.env.HOST || '0.0.0.0'
  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  await app.listen(port, host)
  logger.log(`Server is listening on http://${host}:${port}`)
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
}

bootstrap()
