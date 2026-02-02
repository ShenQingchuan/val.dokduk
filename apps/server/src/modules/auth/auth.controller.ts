import type { Request } from 'express'
import type { AuthenticatedUser } from './auth.dto.js'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import {
  LoginStep1Schema,
  LoginStep2Schema,
  RefreshTokenSchema,
  RegisterSchema,
  UpdateRiotIdSchema,
} from './auth.dto.js'
import { JwtAuthGuard, Public } from './auth.guard.js'
import { AuthService } from './auth.service.js'

/**
 * Get client IP from request
 */
function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.ip
}

/**
 * Parse Zod validation errors into readable message
 */
function formatZodError(error: { issues: ReadonlyArray<{ path: PropertyKey[], message: string }> }): string {
  return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
}

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  /**
   * Register a new user
   * POST /auth/register
   *
   * Client sends: { username, salt, verifier, turnstileToken }
   * Salt and verifier are computed client-side from password using SRP-6a
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: unknown, @Req() req: Request) {
    const result = RegisterSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    return this.authService.register(result.data, getClientIp(req))
  }

  /**
   * SRP Login Step 1
   * POST /auth/login/step1
   *
   * Client sends: { username, clientPublicEphemeral (A), turnstileToken }
   * Server returns: { sessionId, salt, serverPublicEphemeral (B) }
   */
  @Public()
  @Post('login/step1')
  @HttpCode(HttpStatus.OK)
  async loginStep1(@Body() body: unknown, @Req() req: Request) {
    const result = LoginStep1Schema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    return this.authService.loginStep1(result.data, getClientIp(req))
  }

  /**
   * SRP Login Step 2
   * POST /auth/login/step2
   *
   * Client sends: { sessionId, clientProof (M1) }
   * Server returns: { serverProof (M2), accessToken, refreshToken }
   */
  @Public()
  @Post('login/step2')
  @HttpCode(HttpStatus.OK)
  async loginStep2(@Body() body: unknown) {
    const result = LoginStep2Schema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    return this.authService.loginStep2(result.data)
  }

  /**
   * Refresh tokens
   * POST /auth/refresh
   *
   * Client sends: { refreshToken }
   * Server returns: { accessToken, refreshToken }
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown) {
    const result = RefreshTokenSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    return this.authService.refreshTokens(result.data.refreshToken)
  }

  /**
   * Logout
   * POST /auth/logout
   *
   * Requires valid access token
   * Optionally accepts refreshToken in body to blacklist it
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() body: { refreshToken?: string },
  ) {
    await this.authService.logout(req.user.id, body.refreshToken)
    return { success: true }
  }

  /**
   * Get current user
   * GET /auth/me
   *
   * Returns the authenticated user's info
   */
  @Get('me')
  async me(@Req() req: Request & { user: AuthenticatedUser }) {
    const profile = await this.authService.getProfile(req.user.id)
    if (!profile) {
      return {
        id: req.user.id,
        username: req.user.username,
        riotId: null,
      }
    }
    return profile
  }

  /**
   * Update Riot ID
   * POST /auth/riot-id
   *
   * Updates the user's bound Riot ID
   */
  @Post('riot-id')
  @HttpCode(HttpStatus.OK)
  async updateRiotId(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() body: unknown,
  ) {
    const result = UpdateRiotIdSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    return this.authService.updateRiotId(req.user.id, result.data.riotId)
  }
}
