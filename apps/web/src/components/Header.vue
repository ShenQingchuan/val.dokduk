<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { locale } = useI18n()
const router = useRouter()
const route = useRoute()

// 是否显示返回按钮（非首页时显示）
const showBackButton = computed(() => route.path !== '/')

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
        <nav class="flex items-center gap-4">
          <!-- Language toggle -->
          <button
            data-testid="language-toggle"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-val-gray hover:text-val-cream rounded transition-all duration-200"
            @click="toggleLanguage"
          >
            <div class="i-ion-language-sharp w-4 h-4" />
          </button>
        </nav>
      </div>
    </div>

    <!-- Bottom red glow line -->
    <div class="h-px bg-gradient-to-r from-transparent via-val-red/50 to-transparent" />
  </header>
</template>
