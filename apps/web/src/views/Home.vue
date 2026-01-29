<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

const searchInput = ref('')
const searchError = ref('')
const isFocused = ref(false)

function handleSearch() {
  searchError.value = ''

  const input = searchInput.value.trim()
  if (!input) {
    searchError.value = t('search_empty')
    return
  }

  // Support formats: "name#tag" or "name tag"
  const match = input.match(/^(.+?)[#\s](\w+)$/)
  if (!match) {
    searchError.value = t('search_invalid_format')
    return
  }

  const [, name, tag] = match

  if (name && tag) {
    router.push(`/player/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-60px)] flex flex-col">
    <!-- Main content -->
    <div class="flex-1 flex items-center justify-center px-4 pb-32 md:pb-0">
      <div class="w-full max-w-lg mx-auto text-center">
        <!-- Logo -->
        <div class="mb-10">
          <!-- Valorant icon with glow effect -->
          <div class="relative w-auto h-24 mx-auto mb-6 flex items-center justify-center">
            <div class="absolute inset-0 bg-val-red/10 rounded-full blur-2xl animate-pulse" />
            <div class="i-simple-icons-valorant w-20 h-20 text-val-red drop-shadow-[0_0_20px_rgba(255,70,85,0.5)]" />
          </div>

          <!-- Title -->
          <h1 class="font-logo text-5xl md:text-6xl tracking-wider text-val-cream">
            VAL.DOKDUK
          </h1>
          <p class="text-val-gray mt-3 text-sm md:text-base uppercase">
            {{ t('home_subtitle') || 'Valorant Stats Tracker' }}
          </p>
        </div>

        <!-- Search Form -->
        <form class="space-y-4" @submit.prevent="handleSearch">
          <!-- Search box - Valorant angular design -->
          <div class="relative group">
            <!-- Outer frame decoration -->
            <div
              class="absolute -inset-px rounded-lg transition-all duration-300" :class="[
                isFocused ? 'bg-val-red' : 'bg-val-gray-dark/50',
              ]"
            />

            <!-- Inner frame -->
            <div class="relative bg-val-dark rounded-lg">
              <input
                v-model="searchInput"
                type="text"
                :placeholder="t('search_placeholder') || 'Player Name#Tag'"
                class="w-full px-5 py-4 pr-14 text-lg bg-transparent text-val-cream placeholder-val-gray focus:outline-none rounded-lg"
                @focus="isFocused = true"
                @blur="isFocused = false"
              >

              <!-- Search icon button -->
              <button
                type="submit"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-val-gray hover:text-val-red transition-colors"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Error message -->
          <p v-if="searchError" class="text-val-red text-sm animate-shake">
            {{ searchError }}
          </p>

          <!-- Search button (mobile) -->
          <button
            type="submit"
            class="w-full btn-val rounded-lg md:hidden"
          >
            {{ t('search_button') || 'Search' }}
          </button>

          <!-- Hint text -->
          <p class="text-xs text-val-gray mt-4">
            {{ t('search_hint') }}
          </p>
        </form>
      </div>
    </div>

    <!-- Bottom decoration -->
    <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-val-red/5 to-transparent pointer-events-none" />
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
.animate-shake {
  animation: shake 0.3s ease-in-out;
}
</style>
