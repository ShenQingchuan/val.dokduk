import type { NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { Injectable } from '@nestjs/common'
import { expressMiddleware } from 'cls-rtracer'
import { nanoid } from 'nanoid'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    expressMiddleware({
      requestIdFactory: () => nanoid(10), // Generate 10-character unique ID
      echoHeader: true, // Add request ID to response header
      headerName: 'X-Request-Id',
    })(req, res, next)
  }
}
