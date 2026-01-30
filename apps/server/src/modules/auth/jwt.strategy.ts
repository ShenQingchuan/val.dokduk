import type { AuthenticatedUser, JwtPayload } from './auth.dto.js'
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '../../components/config/config.service.js'

/**
 * JWT Strategy for Passport
 * Validates access tokens from Authorization: Bearer header
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    const env = configService.getAll()
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    })
  }

  /**
   * Called after JWT is verified
   * Returns the user object that will be attached to request.user
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Only accept access tokens
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type')
    }

    return {
      id: payload.sub,
      username: payload.username,
    }
  }
}
