<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

// Mode: 'login' or 'register'
const mode = ref<'login' | 'register'>('login')

// Form state
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const turnstileToken = ref('')
const showPassword = ref(false)

// Validation
const usernameError = ref('')
const passwordError = ref('')
const confirmPasswordError = ref('')

// Turnstile widget ID
const turnstileWidgetId = ref<string | null>(null)

// Computed
const isLogin = computed(() => mode.value === 'login')
const isFormValid = computed(() => {
  if (!username.value || !password.value || !turnstileToken.value) {
    return false
  }
  if (!isLogin.value && password.value !== confirmPassword.value) {
    return false
  }
  return !usernameError.value && !passwordError.value && !confirmPasswordError.value
})

// Watchers for validation
watch(username, (val) => {
  usernameError.value = ''
  if (val && !/^[\w-]+$/.test(val)) {
    usernameError.value = t('auth_username_invalid')
  }
  else if (val && (val.length < 3 || val.length > 32)) {
    usernameError.value = t('auth_username_length')
  }
})

watch(password, (val) => {
  passwordError.value = ''
  if (val && val.length < 8) {
    passwordError.value = t('auth_password_length')
  }
})

watch(confirmPassword, (val) => {
  confirmPasswordError.value = ''
  if (!isLogin.value && val && val !== password.value) {
    confirmPasswordError.value = t('auth_password_mismatch')
  }
})

// Actions
function toggleMode() {
  mode.value = isLogin.value ? 'register' : 'login'
  authStore.clearError()
  confirmPassword.value = ''
  confirmPasswordError.value = ''
  resetTurnstile()
}

function resetTurnstile() {
  turnstileToken.value = ''
  if (turnstileWidgetId.value && window.turnstile) {
    window.turnstile.reset(turnstileWidgetId.value)
  }
}

async function handleSubmit() {
  if (!isFormValid.value)
    return

  try {
    if (isLogin.value) {
      await authStore.login(username.value, password.value, turnstileToken.value)
      router.push('/')
    }
    else {
      await authStore.register(username.value, password.value, turnstileToken.value)
      // After registration, switch to login mode
      mode.value = 'login'
      password.value = ''
      resetTurnstile()
    }
  }
  catch {
    resetTurnstile()
  }
}

// Turnstile callback
function onTurnstileVerify(token: string) {
  turnstileToken.value = token
}

function onTurnstileExpire() {
  turnstileToken.value = ''
}

// Initialize Turnstile
onMounted(() => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  if (!siteKey) {
    console.warn('VITE_TURNSTILE_SITE_KEY not set')
    return
  }

  // Wait for Turnstile script to load
  const checkTurnstile = setInterval(() => {
    if (window.turnstile) {
      clearInterval(checkTurnstile)
      turnstileWidgetId.value = window.turnstile.render('#turnstile-container', {
        'sitekey': siteKey,
        'callback': onTurnstileVerify,
        'expired-callback': onTurnstileExpire,
        'theme': 'dark',
      })
    }
  }, 100)
})

// Declare global turnstile type
declare global {
  interface Window {
    turnstile?: {
      render: (container: string, options: {
        'sitekey': string
        'callback': (token: string) => void
        'expired-callback': () => void
        'theme'?: 'light' | 'dark'
      }) => string
      reset: (widgetId: string) => void
    }
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-60px)] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <!-- Card -->
      <div class="bg-val-dark-light border border-val-gray-dark/30 rounded-lg p-8">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="i-simple-icons-valorant w-12 h-12 text-val-red mx-auto mb-4" />
          <h1 class="text-2xl font-bold text-val-cream">
            {{ isLogin ? t('auth_login_title') : t('auth_register_title') }}
          </h1>
          <p class="text-val-gray text-sm mt-2">
            {{ isLogin ? t('auth_login_subtitle') : t('auth_register_subtitle') }}
          </p>
        </div>

        <!-- Form -->
        <form class="space-y-5" @submit.prevent="handleSubmit">
          <!-- Username -->
          <div>
            <label class="block text-val-gray text-sm mb-2">
              {{ t('auth_username') }}
            </label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              class="w-full px-4 py-3 bg-val-dark border border-val-gray-dark/50 rounded-lg text-val-cream placeholder-val-gray focus:outline-none focus:border-val-red transition-colors"
              :placeholder="t('auth_username_placeholder')"
            >
            <p v-if="usernameError" class="text-val-red text-xs mt-1">
              {{ usernameError }}
            </p>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-val-gray text-sm mb-2">
              {{ t('auth_password') }}
            </label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                class="w-full px-4 py-3 pr-12 bg-val-dark border border-val-gray-dark/50 rounded-lg text-val-cream placeholder-val-gray focus:outline-none focus:border-val-red transition-colors"
                :placeholder="t('auth_password_placeholder')"
              >
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-val-gray hover:text-val-cream transition-colors"
                @click="showPassword = !showPassword"
              >
                <div :class="showPassword ? 'i-ion-eye-off-outline' : 'i-ion-eye-outline'" class="w-5 h-5" />
              </button>
            </div>
            <p v-if="passwordError" class="text-val-red text-xs mt-1">
              {{ passwordError }}
            </p>
          </div>

          <!-- Confirm Password (Register only) -->
          <div v-if="!isLogin">
            <label class="block text-val-gray text-sm mb-2">
              {{ t('auth_confirm_password') }}
            </label>
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full px-4 py-3 bg-val-dark border border-val-gray-dark/50 rounded-lg text-val-cream placeholder-val-gray focus:outline-none focus:border-val-red transition-colors"
              :placeholder="t('auth_confirm_password_placeholder')"
            >
            <p v-if="confirmPasswordError" class="text-val-red text-xs mt-1">
              {{ confirmPasswordError }}
            </p>
          </div>

          <!-- Turnstile CAPTCHA -->
          <div class="flex justify-center">
            <div id="turnstile-container" />
          </div>

          <!-- Error message -->
          <p v-if="authStore.error" class="text-val-red text-sm text-center bg-val-red/10 py-2 px-4 rounded-lg">
            {{ authStore.error }}
          </p>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="!isFormValid || authStore.loading"
            class="w-full btn-val rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <div v-if="authStore.loading" class="i-svg-spinners-ring-resize w-5 h-5" />
            {{ isLogin ? t('auth_login_button') : t('auth_register_button') }}
          </button>
        </form>

        <!-- Toggle mode -->
        <div class="mt-6 text-center">
          <p class="text-val-gray text-sm">
            {{ isLogin ? t('auth_no_account') : t('auth_has_account') }}
            <button
              type="button"
              class="text-val-red hover:underline ml-1"
              @click="toggleMode"
            >
              {{ isLogin ? t('auth_register_link') : t('auth_login_link') }}
            </button>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
