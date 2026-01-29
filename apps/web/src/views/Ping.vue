<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

const message = ref('')
const response = ref('')
const error = ref('')
const loading = ref(false)

async function sendPing() {
  if (!message.value.trim())
    return

  loading.value = true
  error.value = ''
  response.value = ''

  try {
    const res = await fetch(`/api/ping?msg=${message.value}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    const data = await res.json() as { msg: string }
    response.value = data.msg
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : t('common_error')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Main Content -->
    <div class="flex flex-col gap-4 max-w-2xl mx-auto px-8 py-16">
      <!-- Back Button -->
      <button
        class="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        @click="router.back()"
      >
        <span>←</span>
        <span>Back</span>
      </button>
      <h1 class="text-4xl tracking-tight mb-8">
        Ping Pong Test
      </h1>

      <!-- Form Section -->
      <div class="space-y-8 flex flex-col gap-4">
        <div>
          <input
            id="message"
            v-model="message"
            type="text"
            :placeholder="t('placeholder_message')"
            class="w-full px-4 py-3 bg-white rounded-lg text-gray-900 placeholder-gray-500 border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors"
          >
        </div>

        <button
          :disabled="loading || !message.trim()"
          class="w-full bg-black text-white rounded-lg py-4 px-8 font-medium tracking-wider hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 uppercase"
          @click="sendPing"
        >
          {{ loading ? t('common_loading') : t('send') }}
        </button>
      </div>

      <!-- Response Section -->
      <div v-if="response || error" class="mt-16 space-y-8">
        <div v-if="response" class="p-8 bg-gray-50 border border-gray-200">
          <h2 class="text-sm mb-4 uppercase tracking-wider">
            {{ t('response') }}
          </h2>
          <p class="text-gray-900 font-mono text-lg">
            {{ response }}
          </p>
        </div>

        <div v-if="error" class="p-8 bg-gray-50 border-l-4 border-black">
          <h2 class="text-sm mb-4 uppercase tracking-wider">
            {{ t('common_error') }}
          </h2>
          <p class="text-gray-900 font-mono">
            {{ error }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
