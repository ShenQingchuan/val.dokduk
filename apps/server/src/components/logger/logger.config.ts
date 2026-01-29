import type { Params } from 'nestjs-pino'
import { join } from 'node:path'
import process from 'node:process'
import { RequestMethod } from '@nestjs/common'
import * as rTracer from 'cls-rtracer'
import pino from 'pino'
import { parseEnv } from '../config/env.js'

const isDevelopment = process.env.NODE_ENV !== 'production'
const env = parseEnv()
const enableFileLog = env.ENABLE_FILE_LOG

// ============ Base Configuration ============

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',
  'req.headers["x-access-token"]',
  'req.body.password',
  'req.body.token',
  'req.body.secret',
]

/**
 * Base Pino configuration
 * - Development: debug level
 * - Production: info level
 */
const baseConfig: pino.LoggerOptions = {
  level: isDevelopment ? 'debug' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: label => ({ level: label.toUpperCase() }),
  },
  // Serializers: control object format in logs
  serializers: {
    req: req => ({
      method: req.method,
      url: req.url,
      requestId: rTracer.id(), // Use cls-rtracer nanoid instead of pino-http's req.id
      remoteAddress: req.remoteAddress,
    }),
    res: res => ({
      statusCode: res.statusCode,
    }),
  },
  // Redact sensitive data from logs
  redact: {
    paths: REDACT_PATHS,
    remove: true, // Completely remove sensitive fields to save storage
  },
}

// ============ File Transport Configuration ============

/**
 * Create file transport (JSON format for log analysis)
 * - Rotation: daily, max 20MB
 * - Format: single-line JSON, no formatting
 * - File naming: app-YYYY-MM-DD-N.log (N is rotation index)
 */
function createFileTransport() {
  return pino.transport({
    target: 'pino-roll',
    options: {
      file: join(import.meta.dirname, '../../logs/app'),
      frequency: 'daily',
      mkdir: true,
      size: '20m',
      extension: '.log',
    },
  })
}

// ============ Console Transport Configuration ============

/**
 * Create console transport
 * - Development: with colors
 * - Production: without colors
 * Both use consistent format with key information
 */
const CONSOLE_LOG_IGNORES_LIST = ['pid', 'hostname', 'res']
function createConsoleTransport() {
  return pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: isDevelopment,
      singleLine: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: CONSOLE_LOG_IGNORES_LIST.join(','),
    },
  })
}

// ============ Stream Assembly ============

// Build streams array based on ENABLE_FILE_LOG configuration
// Console transport is always enabled
const streams = [{ stream: createConsoleTransport() }]
// File transport is optional based on ENABLE_FILE_LOG
if (enableFileLog) {
  streams.unshift({ stream: createFileTransport() })
}

// ============ NestJS Pino Configuration ============

export const loggerConfig: Params = {
  // Use new path-to-regexp syntax to avoid deprecation warning
  // See: https://github.com/pillarjs/path-to-regexp/blob/master/MIGRATION.md
  forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
  pinoHttp: {
    logger: pino(baseConfig, pino.multistream(streams)),

    // Auto-set log level based on status code
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500)
        return 'error'
      if (res.statusCode >= 400)
        return 'warn'
      if (res.statusCode >= 300)
        return 'info'
      return 'info'
    },

    // Inject custom properties into logs
    customProps: (req, res) => {
      return {
        requestId: rTracer.id(), // Use cls-rtracer nanoid
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
      }
    },
  },
}
