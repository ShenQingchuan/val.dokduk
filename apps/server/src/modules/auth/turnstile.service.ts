import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '../../components/config/config.service.js'

interface TurnstileResponse {
  'success': boolean
  'error-codes'?: string[]
  'challenge_ts'?: string
  'hostname'?: string
}

/**
 * Cloudflare Turnstile verification service
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name)
  private readonly secretKey: string
  private readonly verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.secretKey = this.configService.getAll().TURNSTILE_SECRET_KEY
  }

  /**
   * Verify Turnstile token
   * @param token - The token from client-side Turnstile widget
   * @param remoteip - Optional client IP address
   * @returns true if verification succeeds
   */
  async verify(token: string, remoteip?: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams()
      formData.append('secret', this.secretKey)
      formData.append('response', token)
      if (remoteip) {
        formData.append('remoteip', remoteip)
      }

      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      })

      const data = await response.json() as TurnstileResponse

      if (!data.success) {
        this.logger.warn('Turnstile verification failed', {
          errorCodes: data['error-codes'],
        })
        return false
      }

      return true
    }
    catch (error) {
      this.logger.error('Turnstile verification error:', error)
      return false
    }
  }
}
