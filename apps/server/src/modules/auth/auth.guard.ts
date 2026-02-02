import type { ExecutionContext } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { Inject, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

/**
 * Decorator to mark routes as public (no auth required)
 */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/**
 * JWT Auth Guard with public route support
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Inject(Reflector) private reflector: Reflector,
  ) {
    super()
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      // For public routes, still try to extract user from JWT if present
      // but don't require authentication
      return Promise.resolve(super.canActivate(context))
        .then(() => true)
        .catch(() => true) // Allow access even if JWT validation fails
    }

    return super.canActivate(context)
  }
}
