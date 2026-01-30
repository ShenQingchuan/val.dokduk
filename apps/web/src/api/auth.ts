import type { SRPLoginSession } from '../utils/srp'
import { completeSRPLogin, generateSRPCredentials, startSRPLogin } from '../utils/srp'
import { apiClient } from './client'

// Response types
interface LoginStep1Response {
  sessionId: string
  salt: string
  serverPublicEphemeral: string
}

interface LoginStep2Response {
  serverProof: string
  accessToken: string
  refreshToken: string
}

interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

interface UserInfo {
  id: string
  username: string
}

// Storage keys
const ACCESS_TOKEN_KEY = 'auth_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'

/**
 * Store tokens in localStorage
 */
function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/**
 * Clear stored tokens
 */
function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

/**
 * Get stored access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * Get stored refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/**
 * Check if user is logged in (has valid access token)
 */
export function isLoggedIn(): boolean {
  return !!getAccessToken()
}

/**
 * Auth API
 */
export const authApi = {
  /**
   * Register a new user
   * Password is never sent to server - SRP credentials are computed client-side
   */
  async register(username: string, password: string, turnstileToken: string): Promise<{ success: true }> {
    // Generate SRP credentials client-side
    const { salt, verifier } = await generateSRPCredentials(username, password)

    return apiClient.post('/api/auth/register', {
      username,
      salt,
      verifier,
      turnstileToken,
    })
  },

  /**
   * Login using SRP-6a protocol
   * Password never leaves the browser - zero-knowledge proof
   */
  async login(username: string, password: string, turnstileToken: string): Promise<{
    user: UserInfo
    accessToken: string
    refreshToken: string
  }> {
    // Step 1: Prepare client session (hash username + password)
    const srpSession: SRPLoginSession = await startSRPLogin(username, password)

    // Step 2: Request salt and B from server
    const step1Response = await apiClient.post<LoginStep1Response>('/api/auth/login/step1', {
      username,
      turnstileToken,
    })

    // Step 3: Compute A and M1 using server's salt and B
    const { clientPublicEphemeral, clientProof } = await completeSRPLogin(
      srpSession,
      step1Response.salt,
      step1Response.serverPublicEphemeral,
    )

    // Step 4: Send A and M1 to server and get tokens
    const step2Response = await apiClient.post<LoginStep2Response>('/api/auth/login/step2', {
      sessionId: step1Response.sessionId,
      clientPublicEphemeral,
      clientProof,
    })

    // Store tokens
    storeTokens(step2Response.accessToken, step2Response.refreshToken)

    // Get user info
    const user = await this.me()

    return {
      user,
      accessToken: step2Response.accessToken,
      refreshToken: step2Response.refreshToken,
    }
  },

  /**
   * Refresh access token
   */
  async refresh(): Promise<{ accessToken: string, refreshToken: string }> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      throw new Error('No refresh token')
    }

    const response = await apiClient.post<RefreshResponse>('/api/auth/refresh', {
      refreshToken,
    })

    storeTokens(response.accessToken, response.refreshToken)
    return response
  },

  /**
   * Logout
   */
  async logout(): Promise<void> {
    const refreshToken = getRefreshToken()
    try {
      await apiClient.post('/api/auth/logout', { refreshToken })
    }
    catch {
      // Ignore errors - we'll clear tokens anyway
    }
    finally {
      clearTokens()
    }
  },

  /**
   * Get current user info
   */
  async me(): Promise<UserInfo> {
    return apiClient.get('/api/auth/me')
  },
}
