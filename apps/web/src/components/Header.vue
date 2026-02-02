<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const { locale, t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 是否显示返回按钮（非首页时显示）
const showBackButton = computed(() => route.path !== '/' && route.path !== '/auth')

// Menu states
const showUserMenu = ref(false)
const showMobileMenu = ref(false)

function toggleLanguage() {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
}

function goHome() {
  router.push('/')
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  }
  else {
    router.push('/')
  }
}

function goToAuth() {
  showMobileMenu.value = false
  router.push('/auth')
}

async function handleLogout() {
  showUserMenu.value = false
  showMobileMenu.value = false
  await authStore.logout()
  router.push('/')
}

// Close dropdowns when clicking outside
function closeMenus(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.user-menu-container')) {
    showUserMenu.value = false
  }
  if (!target.closest('.mobile-menu-container')) {
    showMobileMenu.value = false
  }
}

// Fetch user on mount if token exists
onMounted(() => {
  authStore.fetchUser()
  document.addEventListener('click', closeMenus)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
})
</script>

<template>
  <header class="sticky top-0 z-50 bg-val-black/95 backdrop-blur-sm border-b border-val-gray-dark/30">
    <div class="max-w-7xl mx-auto px-4 md:px-8 py-3">
      <div class="flex items-center justify-between">
        <!-- Left: Back button (mobile) or Logo (desktop) -->
        <div class="flex items-center gap-2 md:gap-3">
          <!-- Back button - only on non-home pages -->
          <button
            v-if="showBackButton"
            class="p-1.5 text-val-gray hover:text-val-cream transition-colors"
            @click="goBack"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <!-- Logo - hidden on mobile when back button shows -->
          <button
            class="group items-center gap-2 hover:opacity-80 transition-opacity hidden md:flex"
            @click="goHome"
          >
            <div class="i-simple-icons-valorant w-7 h-7 text-val-red group-hover:text-val-red-glow transition-colors" />
            <span
              data-testid="app-name"
              class="font-logo text-2xl tracking-wider text-val-cream translate-y-1.5"
            >
              VAL.DOKDUK
            </span>
          </button>
        </div>

        <!-- Center: Logo on mobile -->
        <button
          class="group flex items-center gap-2 hover:opacity-80 transition-opacity md:hidden absolute left-1/2 -translate-x-1/2"
          @click="goHome"
        >
          <div class="i-simple-icons-valorant w-6 h-6 text-val-red group-hover:text-val-red-glow transition-colors" />
          <span
            class="font-logo text-xl tracking-wider text-val-cream translate-y-1"
          >
            VAL.DOKDUK
          </span>
        </button>

        <!-- Right side navigation -->
        <nav class="flex items-center gap-2 md:gap-4">
          <!-- Mobile: Hamburger menu -->
          <div class="relative mobile-menu-container md:hidden">
            <button
              class="p-2 text-val-gray hover:text-val-cream transition-colors"
              @click.stop="showMobileMenu = !showMobileMenu"
            >
              <div class="w-5 h-5" :class="showMobileMenu ? 'i-ion-close' : 'i-ion-menu'" />
            </button>

            <!-- Mobile dropdown -->
            <div
              v-show="showMobileMenu"
              class="absolute right-0 top-full mt-2 w-56 bg-val-dark-light border border-val-gray-dark/30 rounded-lg shadow-xl overflow-hidden"
            >
              <!-- User info (if logged in) -->
              <div v-if="authStore.isLoggedIn" class="px-4 py-3 border-b border-val-gray-dark/30">
                <div class="flex items-center gap-2">
                  <div class="i-ion-person-circle-outline w-5 h-5 text-val-cream" />
                  <p class="text-val-cream font-medium truncate">
                    {{ authStore.username }}
                  </p>
                </div>
              </div>

              <!-- Language toggle -->
              <button
                class="w-full flex items-center gap-3 px-4 py-3 text-sm text-val-gray hover:bg-val-gray-dark/30 hover:text-val-cream transition-colors"
                @click="toggleLanguage"
              >
                <div class="i-ion-language-sharp w-4 h-4" />
                {{ locale === 'en' ? '中文' : 'English' }}
              </button>

              <!-- Login / Logout -->
              <button
                v-if="authStore.isLoggedIn"
                class="w-full flex items-center gap-3 px-4 py-3 text-sm text-val-gray hover:bg-val-red/10 hover:text-val-red transition-colors"
                @click="handleLogout"
              >
                <div class="i-ion-log-out-outline w-4 h-4" />
                {{ t('nav_logout') }}
              </button>
              <button
                v-else
                class="w-full flex items-center gap-3 px-4 py-3 text-sm text-val-gray hover:bg-val-gray-dark/30 hover:text-val-cream transition-colors"
                @click="goToAuth"
              >
                <div class="i-ion-person-outline w-4 h-4" />
                {{ t('nav_login') }}
              </button>
            </div>
          </div>

          <!-- Desktop: Language toggle -->
          <button
            data-testid="language-toggle"
            class="hidden md:flex items-center gap-1.5 px-2 py-1.5 text-sm text-val-gray hover:text-val-cream rounded transition-all duration-200"
            @click="toggleLanguage"
          >
            <div class="i-ion-language-sharp w-4 h-4" />
          </button>

          <!-- Desktop: Auth button / User menu -->
          <div v-if="authStore.isLoggedIn" class="relative user-menu-container hidden md:block">
            <button
              class="flex items-center gap-2 px-3 py-1.5 text-sm text-val-cream hover:bg-val-gray-dark/30 rounded-lg transition-colors"
              @click="showUserMenu = !showUserMenu"
            >
              <div class="i-ion-person-circle-outline w-5 h-5" />
              <span>{{ authStore.username }}</span>
              <div class="i-ion-chevron-down-outline w-4 h-4 transition-transform" :class="showUserMenu && 'rotate-180'" />
            </button>

            <!-- Desktop dropdown -->
            <div
              v-show="showUserMenu"
              class="absolute right-0 top-full mt-2 w-48 bg-val-dark-light border border-val-gray-dark/30 rounded-lg shadow-xl overflow-hidden"
            >
              <div class="px-4 py-3 border-b border-val-gray-dark/30">
                <p class="text-val-cream font-medium truncate">
                  {{ authStore.username }}
                </p>
              </div>
              <button
                class="w-full flex items-center gap-2 px-4 py-3 text-sm text-val-gray hover:bg-val-red/10 hover:text-val-red transition-colors"
                @click="handleLogout"
              >
                <div class="i-ion-log-out-outline w-4 h-4" />
                {{ t('nav_logout') }}
              </button>
            </div>
          </div>

          <!-- Desktop: Login button (not logged in) -->
          <button
            v-else-if="!authStore.isLoggedIn"
            class="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-val-cream hover:bg-val-red/20 rounded-lg transition-colors"
            @click="goToAuth"
          >
            <div class="i-ion-person-outline w-4 h-4" />
            <span>{{ t('nav_login') }}</span>
          </button>
        </nav>
      </div>
    </div>

    <!-- Bottom red glow line -->
    <div class="h-px bg-gradient-to-r from-transparent via-val-red/50 to-transparent" />
  </header>
</template>
