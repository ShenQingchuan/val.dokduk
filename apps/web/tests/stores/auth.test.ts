import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../src/api/auth'
import { useAuthStore } from '../../src/stores/auth'

// Mock the auth API module
vi.mock('../../src/api/auth', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
    updateRiotId: vi.fn(),
  },
  getAccessToken: vi.fn(),
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have null user initially', () => {
      const store = useAuthStore()

      expect(store.user).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })

    it('should have loading false initially', () => {
      const store = useAuthStore()

      expect(store.loading).toBe(false)
    })

    it('should have null error initially', () => {
      const store = useAuthStore()

      expect(store.error).toBeNull()
    })

    it('should have undefined username when not logged in', () => {
      const store = useAuthStore()

      expect(store.username).toBeUndefined()
    })

    it('should have undefined riotId when not logged in', () => {
      const store = useAuthStore()

      expect(store.riotId).toBeUndefined()
    })
  })

  describe('register', () => {
    it('should call authApi.register with correct params', async () => {
      vi.mocked(authApi.authApi.register).mockResolvedValue({ success: true })

      const store = useAuthStore()
      await store.register('testuser', 'password123', 'turnstile-token')

      expect(authApi.authApi.register).toHaveBeenCalledWith(
        'testuser',
        'password123',
        'turnstile-token',
      )
    })

    it('should set loading to true during registration', async () => {
      let resolvePromise!: (value: { success: true }) => void
      vi.mocked(authApi.authApi.register).mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve }),
      )

      const store = useAuthStore()
      const promise = store.register('testuser', 'password', 'token')

      expect(store.loading).toBe(true)

      resolvePromise({ success: true })
      await promise

      expect(store.loading).toBe(false)
    })

    it('should set error on registration failure', async () => {
      vi.mocked(authApi.authApi.register).mockRejectedValue(new Error('Username taken'))

      const store = useAuthStore()

      await expect(store.register('testuser', 'password', 'token')).rejects.toThrow()

      expect(store.error).toBe('Username taken')
      expect(store.loading).toBe(false)
    })

    it('should clear previous error before registration', async () => {
      vi.mocked(authApi.authApi.register).mockResolvedValue({ success: true })

      const store = useAuthStore()
      store.error = 'Previous error'

      await store.register('testuser', 'password', 'token')

      expect(store.error).toBeNull()
    })
  })

  describe('login', () => {
    it('should set user on successful login', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: null }
      vi.mocked(authApi.authApi.login).mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })

      const store = useAuthStore()
      await store.login('testuser', 'password', 'token')

      expect(store.user).toEqual(mockUser)
      expect(store.isLoggedIn).toBe(true)
    })

    it('should set username computed property', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: null }
      vi.mocked(authApi.authApi.login).mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })

      const store = useAuthStore()
      await store.login('testuser', 'password', 'token')

      expect(store.username).toBe('testuser')
    })

    it('should set riotId computed property when user has Riot ID', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: 'Player#TAG' }
      vi.mocked(authApi.authApi.login).mockResolvedValue({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })

      const store = useAuthStore()
      await store.login('testuser', 'password', 'token')

      expect(store.riotId).toBe('Player#TAG')
    })

    it('should set error on login failure', async () => {
      vi.mocked(authApi.authApi.login).mockRejectedValue(new Error('Invalid credentials'))

      const store = useAuthStore()

      await expect(store.login('testuser', 'wrong', 'token')).rejects.toThrow()

      expect(store.error).toBe('Invalid credentials')
      expect(store.user).toBeNull()
    })

    it('should set loading state during login', async () => {
      let resolvePromise: (value: any) => void
      vi.mocked(authApi.authApi.login).mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve }),
      )

      const store = useAuthStore()
      const promise = store.login('testuser', 'password', 'token')

      expect(store.loading).toBe(true)

      resolvePromise!({ user: { id: '1', username: 'testuser', riotId: null } })
      await promise

      expect(store.loading).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear user state on logout', async () => {
      vi.mocked(authApi.authApi.logout).mockResolvedValue(undefined)

      const store = useAuthStore()
      store.user = { id: '1', username: 'testuser', riotId: null }

      await store.logout()

      expect(store.user).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })

    it('should clear user even if logout API fails', async () => {
      vi.mocked(authApi.authApi.logout).mockRejectedValue(new Error('Network error'))

      const store = useAuthStore()
      store.user = { id: '1', username: 'testuser', riotId: null }

      // Logout still clears user in finally block even when API fails
      try {
        await store.logout()
      }
      catch {
        // Expected to throw, but user should still be cleared
      }

      expect(store.user).toBeNull()
    })
  })

  describe('fetchUser', () => {
    it('should set user to null when no access token', async () => {
      vi.mocked(authApi.getAccessToken).mockReturnValue(null)

      const store = useAuthStore()
      store.user = { id: '1', username: 'cached', riotId: null }

      await store.fetchUser()

      expect(store.user).toBeNull()
      expect(authApi.authApi.me).not.toHaveBeenCalled()
    })

    it('should fetch user when access token exists', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: null }
      vi.mocked(authApi.getAccessToken).mockReturnValue('valid-token')
      vi.mocked(authApi.authApi.me).mockResolvedValue(mockUser)

      const store = useAuthStore()
      await store.fetchUser()

      expect(store.user).toEqual(mockUser)
    })

    it('should try refresh token when me() fails', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: null }
      vi.mocked(authApi.getAccessToken).mockReturnValue('expired-token')
      vi.mocked(authApi.authApi.me)
        .mockRejectedValueOnce(new Error('Unauthorized'))
        .mockResolvedValueOnce(mockUser)
      vi.mocked(authApi.authApi.refresh).mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      })

      const store = useAuthStore()
      await store.fetchUser()

      expect(authApi.authApi.refresh).toHaveBeenCalled()
      expect(store.user).toEqual(mockUser)
    })

    it('should clear user when refresh also fails', async () => {
      vi.mocked(authApi.getAccessToken).mockReturnValue('expired-token')
      vi.mocked(authApi.authApi.me).mockRejectedValue(new Error('Unauthorized'))
      vi.mocked(authApi.authApi.refresh).mockRejectedValue(new Error('Refresh failed'))

      const store = useAuthStore()
      store.user = { id: '1', username: 'cached', riotId: null }

      await store.fetchUser()

      expect(store.user).toBeNull()
    })

    it('should deduplicate concurrent fetchUser calls', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: null }
      vi.mocked(authApi.getAccessToken).mockReturnValue('valid-token')
      vi.mocked(authApi.authApi.me).mockResolvedValue(mockUser)

      const store = useAuthStore()

      // Call fetchUser multiple times concurrently
      const promises = [store.fetchUser(), store.fetchUser(), store.fetchUser()]
      await Promise.all(promises)

      // Should only call API once due to deduplication
      expect(authApi.authApi.me).toHaveBeenCalledTimes(1)
    })

    it('should allow new fetchUser after previous completes', async () => {
      const mockUser = { id: '1', username: 'testuser', riotId: null }
      vi.mocked(authApi.getAccessToken).mockReturnValue('valid-token')
      vi.mocked(authApi.authApi.me).mockResolvedValue(mockUser)

      const store = useAuthStore()

      await store.fetchUser()
      await store.fetchUser()

      // Should call twice since they are sequential
      expect(authApi.authApi.me).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      const store = useAuthStore()
      store.error = 'Some error'

      store.clearError()

      expect(store.error).toBeNull()
    })
  })

  describe('updateRiotId', () => {
    it('should update Riot ID in user state', async () => {
      vi.mocked(authApi.authApi.updateRiotId).mockResolvedValue({ success: true })

      const store = useAuthStore()
      store.user = { id: '1', username: 'testuser', riotId: null }

      await store.updateRiotId('NewPlayer#TAG')

      expect(store.user?.riotId).toBe('NewPlayer#TAG')
      expect(authApi.authApi.updateRiotId).toHaveBeenCalledWith('NewPlayer#TAG')
    })

    it('should allow clearing Riot ID with null', async () => {
      vi.mocked(authApi.authApi.updateRiotId).mockResolvedValue({ success: true })

      const store = useAuthStore()
      store.user = { id: '1', username: 'testuser', riotId: 'OldPlayer#TAG' }

      await store.updateRiotId(null)

      expect(store.user?.riotId).toBeNull()
    })

    it('should not update state if user is null', async () => {
      vi.mocked(authApi.authApi.updateRiotId).mockResolvedValue({ success: true })

      const store = useAuthStore()
      store.user = null

      await store.updateRiotId('Player#TAG')

      // Should still call API
      expect(authApi.authApi.updateRiotId).toHaveBeenCalled()
      // User should remain null
      expect(store.user).toBeNull()
    })

    it('should set error on update failure', async () => {
      vi.mocked(authApi.authApi.updateRiotId).mockRejectedValue(new Error('Invalid format'))

      const store = useAuthStore()
      store.user = { id: '1', username: 'testuser', riotId: null }

      await expect(store.updateRiotId('invalid')).rejects.toThrow()

      expect(store.error).toBe('Invalid format')
    })

    it('should set loading state during update', async () => {
      let resolvePromise!: (value: { success: true }) => void
      vi.mocked(authApi.authApi.updateRiotId).mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve }),
      )

      const store = useAuthStore()
      store.user = { id: '1', username: 'testuser', riotId: null }

      const promise = store.updateRiotId('Player#TAG')

      expect(store.loading).toBe(true)

      resolvePromise({ success: true })
      await promise

      expect(store.loading).toBe(false)
    })
  })
})
