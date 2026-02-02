import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi, getAccessToken } from '../api/auth'

interface User {
  id: string
  username: string
  riotId: string | null
}

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let fetchUserPromise: Promise<void> | null = null

  // Computed
  const isLoggedIn = computed(() => !!user.value)
  const username = computed(() => user.value?.username)
  const riotId = computed(() => user.value?.riotId)

  // Actions
  async function register(username: string, password: string, turnstileToken: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await authApi.register(username, password, turnstileToken)
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Registration failed'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string, turnstileToken: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await authApi.login(username, password, turnstileToken)
      user.value = result.user
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Login failed'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    loading.value = true
    try {
      await authApi.logout()
    }
    finally {
      user.value = null
      loading.value = false
    }
  }

  async function fetchUser(): Promise<void> {
    // 如果已经有正在进行的请求，复用它
    if (fetchUserPromise) {
      return fetchUserPromise
    }

    if (!getAccessToken()) {
      user.value = null
      return
    }

    fetchUserPromise = (async () => {
      try {
        user.value = await authApi.me()
      }
      catch {
        // Token might be expired, try to refresh
        try {
          await authApi.refresh()
          user.value = await authApi.me()
        }
        catch {
          // Refresh failed, clear user
          user.value = null
        }
      }
      finally {
        fetchUserPromise = null
      }
    })()

    return fetchUserPromise
  }

  function clearError(): void {
    error.value = null
  }

  async function updateRiotId(newRiotId: string | null): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await authApi.updateRiotId(newRiotId)
      if (user.value) {
        user.value = { ...user.value, riotId: newRiotId }
      }
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update Riot ID'
      throw e
    }
    finally {
      loading.value = false
    }
  }

  return {
    // State
    user,
    loading,
    error,
    // Computed
    isLoggedIn,
    username,
    riotId,
    // Actions
    register,
    login,
    logout,
    fetchUser,
    clearError,
    updateRiotId,
  }
})
