import { z } from 'zod'

/**
 * SRP-6a Registration DTOs
 * Client sends: username, salt, verifier (computed from password locally)
 * Server NEVER receives the actual password
 */
export const RegisterSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[\w-]+$/, {
    message: 'Username can only contain letters, numbers, underscores, and hyphens',
  }),
  salt: z.string().min(1), // SRP salt (hex)
  verifier: z.string().min(1), // SRP verifier (hex)
  turnstileToken: z.string().min(1), // Cloudflare Turnstile token
})

export type RegisterDto = z.infer<typeof RegisterSchema>

/**
 * SRP-6a Login Step 1: Client sends username to get salt and B
 */
export const LoginStep1Schema = z.object({
  username: z.string().min(1),
  turnstileToken: z.string().min(1),
})

export type LoginStep1Dto = z.infer<typeof LoginStep1Schema>

/**
 * SRP-6a Login Step 1 Response: Server sends salt, B, and session ID
 */
export interface LoginStep1Response {
  sessionId: string
  salt: string // User's salt from DB
  serverPublicEphemeral: string // B value (hex)
}

/**
 * SRP-6a Login Step 2: Client sends A and M1 to prove it knows the password
 */
export const LoginStep2Schema = z.object({
  sessionId: z.string().min(1),
  clientPublicEphemeral: z.string().min(1), // A value (hex)
  clientProof: z.string().min(1), // M1 value (hex)
})

export type LoginStep2Dto = z.infer<typeof LoginStep2Schema>

/**
 * SRP-6a Login Step 2 Response: Server proves it has the verifier
 */
export interface LoginStep2Response {
  serverProof: string // M2 value (hex)
  accessToken: string
  refreshToken: string
}

/**
 * Token refresh DTO
 */
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>

/**
 * JWT Payload
 */
export interface JwtPayload {
  sub: string // User ID
  username: string
  type: 'access' | 'refresh'
  iat?: number
  exp?: number
}

/**
 * Validated user from JWT
 */
export interface AuthenticatedUser {
  id: string
  username: string
}
