import type { Redis } from 'ioredis'
import type { Database } from '../../database/index.js'
import type {
  AuthenticatedUser,
  JwtPayload,
  LoginStep1Dto,
  LoginStep1Response,
  LoginStep2Dto,
  LoginStep2Response,
  RegisterDto,
} from './auth.dto.js'
import { BadRequestException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { SRPParameters, SRPRoutines, SRPServerSession, SRPServerSessionStep1 } from 'tssrp6a'
import { REDIS_TOKEN } from '../../common/redis.module.js'
import { ConfigService } from '../../components/config/config.service.js'
import { DATABASE_TOKEN } from '../../database/database.module.js'
import { authUsers } from '../../database/schema.js'
import { TurnstileService } from './turnstile.service.js'

// SRP session stored in Redis during login flow
interface SRPSessionData {
  username: string
  serverStep1State: string // Serialized SRPServerSessionStep1 state
  createdAt: number
}

// Convert string duration to seconds
function durationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match)
    return 7 * 24 * 60 * 60 // default 7 days
  const [, num, unit] = match
  const value = Number.parseInt(num, 10)
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 60 * 60
    case 'd': return value * 24 * 60 * 60
    default: return 7 * 24 * 60 * 60
  }
}

/**
 * Authentication service implementing SRP-6a protocol
 * The password NEVER leaves the client's browser
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly srpParams: SRPParameters
  private readonly srpRoutines: SRPRoutines
  private readonly accessTokenExpiry: number
  private readonly refreshTokenExpiry: number

  // Redis key prefixes
  private readonly SRP_SESSION_PREFIX = 'auth:srp:'
  private readonly REFRESH_TOKEN_PREFIX = 'auth:refresh:'
  private readonly TOKEN_BLACKLIST_PREFIX = 'auth:blacklist:'

  // TTLs
  private readonly SRP_SESSION_TTL = 300 // 5 minutes for SRP handshake

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: Database,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(TurnstileService) private readonly turnstileService: TurnstileService,
  ) {
    // Use SHA-256 with 2048-bit group (secure default)
    this.srpParams = new SRPParameters()
    this.srpRoutines = new SRPRoutines(this.srpParams)

    const env = this.configService.getAll()
    this.accessTokenExpiry = durationToSeconds(env.JWT_ACCESS_EXPIRES_IN)
    this.refreshTokenExpiry = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN)
  }

  /**
   * Register a new user with SRP credentials
   * Client computes salt and verifier from password, server never sees password
   */
  async register(dto: RegisterDto, clientIp?: string): Promise<{ success: true }> {
    // Verify Turnstile first
    const turnstileValid = await this.turnstileService.verify(dto.turnstileToken, clientIp)
    if (!turnstileValid) {
      throw new BadRequestException('CAPTCHA verification failed')
    }

    // Check if username already exists
    const existing = await this.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.username, dto.username.toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      throw new BadRequestException('Username already exists')
    }

    // Store user with SRP credentials
    await this.db.insert(authUsers).values({
      username: dto.username.toLowerCase(),
      srpSalt: dto.salt,
      srpVerifier: dto.verifier,
    })

    this.logger.log(`User registered: ${dto.username}`)
    return { success: true }
  }

  /**
   * SRP Login Step 1: Server receives A, returns B
   */
  async loginStep1(dto: LoginStep1Dto, clientIp?: string): Promise<LoginStep1Response> {
    // Verify Turnstile
    const turnstileValid = await this.turnstileService.verify(dto.turnstileToken, clientIp)
    if (!turnstileValid) {
      throw new BadRequestException('CAPTCHA verification failed')
    }

    // Find user
    const users = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.username, dto.username.toLowerCase()))
      .limit(1)

    if (users.length === 0) {
      // Don't reveal if user exists - use dummy values
      throw new UnauthorizedException('Invalid credentials')
    }

    const user = users[0]

    // Create SRP server session and run step1
    const serverSession = new SRPServerSession(this.srpRoutines)
    const serverStep1 = await serverSession.step1(
      dto.username.toLowerCase(),
      BigInt(`0x${user.srpSalt}`),
      BigInt(`0x${user.srpVerifier}`),
    )

    // Generate session ID and store session data in Redis
    const sessionId = nanoid(32)
    const sessionData: SRPSessionData = {
      username: user.username,
      serverStep1State: JSON.stringify(serverStep1.toJSON()),
      createdAt: Date.now(),
    }

    await this.redis.setex(
      this.SRP_SESSION_PREFIX + sessionId,
      this.SRP_SESSION_TTL,
      JSON.stringify(sessionData),
    )

    return {
      sessionId,
      salt: user.srpSalt,
      serverPublicEphemeral: serverStep1.B.toString(16),
    }
  }

  /**
   * SRP Login Step 2: Verify client proof M1, return server proof M2 and tokens
   */
  async loginStep2(dto: LoginStep2Dto): Promise<LoginStep2Response> {
    // Retrieve session from Redis
    const sessionStr = await this.redis.get(this.SRP_SESSION_PREFIX + dto.sessionId)
    if (!sessionStr) {
      throw new UnauthorizedException('Session expired or invalid')
    }

    const sessionData: SRPSessionData = JSON.parse(sessionStr)

    // Delete session (single use)
    await this.redis.del(this.SRP_SESSION_PREFIX + dto.sessionId)

    try {
      // Restore SRP server session from stored state
      const serverStep1 = SRPServerSessionStep1.fromState(
        this.srpRoutines,
        JSON.parse(sessionData.serverStep1State),
      )

      // Step 2: Verify client proof M1 and get server proof M2
      const M2 = await serverStep1.step2(
        BigInt(`0x${dto.clientPublicEphemeral}`),
        BigInt(`0x${dto.clientProof}`),
      )

      // Find user for token generation
      const users = await this.db
        .select()
        .from(authUsers)
        .where(eq(authUsers.username, sessionData.username))
        .limit(1)

      if (users.length === 0) {
        throw new UnauthorizedException('User not found')
      }

      const user = users[0]

      // Generate JWT tokens
      const { accessToken, refreshToken } = await this.generateTokens(user.id, user.username)

      this.logger.log(`User logged in: ${user.username}`)

      return {
        serverProof: M2.toString(16),
        accessToken,
        refreshToken,
      }
    }
    catch (error) {
      this.logger.warn('SRP verification failed', { error })
      throw new UnauthorizedException('Invalid credentials')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(refreshToken)

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type')
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.redis.exists(this.TOKEN_BLACKLIST_PREFIX + refreshToken)
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked')
      }

      // Check if refresh token exists in Redis (valid session)
      const storedToken = await this.redis.get(this.REFRESH_TOKEN_PREFIX + payload.sub)
      if (storedToken !== refreshToken) {
        // Token rotation detected - potential theft, invalidate all tokens
        await this.redis.del(this.REFRESH_TOKEN_PREFIX + payload.sub)
        throw new UnauthorizedException('Invalid refresh token')
      }

      // Generate new tokens (rotate refresh token)
      const tokens = await this.generateTokens(payload.sub, payload.username)

      // Blacklist old refresh token
      await this.redis.setex(
        this.TOKEN_BLACKLIST_PREFIX + refreshToken,
        this.refreshTokenExpiry,
        '1',
      )

      return tokens
    }
    catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error
      }
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  /**
   * Logout - invalidate tokens
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    // Remove refresh token from Redis
    await this.redis.del(this.REFRESH_TOKEN_PREFIX + userId)

    // Blacklist the refresh token if provided
    if (refreshToken) {
      await this.redis.setex(
        this.TOKEN_BLACKLIST_PREFIX + refreshToken,
        this.refreshTokenExpiry,
        '1',
      )
    }

    this.logger.log(`User logged out: ${userId}`)
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token)

      if (payload.type !== 'access') {
        return null
      }

      return {
        id: payload.sub,
        username: payload.username,
      }
    }
    catch {
      return null
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(userId: string, username: string): Promise<{
    accessToken: string
    refreshToken: string
  }> {
    const accessPayload: JwtPayload = {
      sub: userId,
      username,
      type: 'access',
    }

    const refreshPayload: JwtPayload = {
      sub: userId,
      username,
      type: 'refresh',
    }

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.accessTokenExpiry,
    })

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.refreshTokenExpiry,
    })

    // Store refresh token in Redis for validation
    await this.redis.setex(
      this.REFRESH_TOKEN_PREFIX + userId,
      this.refreshTokenExpiry,
      refreshToken,
    )

    return { accessToken, refreshToken }
  }
}
