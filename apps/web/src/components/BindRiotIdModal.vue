<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()
const authStore = useAuthStore()

const riotId = ref('')
const error = ref('')
const loading = ref(false)

// Riot ID format regex: GameName#Tag
const riotIdRegex = /^.+#\w+$/

// Clear input when modal opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    riotId.value = ''
    error.value = ''
  }
})

function close() {
  emit('update:modelValue', false)
}

function validateRiotId(value: string): boolean {
  if (!value)
    return true // Empty is valid (unbind)
  return riotIdRegex.test(value)
}

async function handleSubmit() {
  error.value = ''

  // Validate format if not empty
  if (riotId.value && !validateRiotId(riotId.value)) {
    error.value = t('bind_riot_id_invalid')
    return
  }

  loading.value = true
  try {
    await authStore.updateRiotId(riotId.value || null)
    close()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    loading.value = false
  }
}

async function handleUnbind() {
  loading.value = true
  try {
    await authStore.updateRiotId(null)
    riotId.value = ''
    close()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-100 flex items-center justify-center p-4"
        @click.self="close"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <!-- Modal -->
        <div class="relative w-full max-w-sm bg-val-dark border border-val-gray-dark/50 rounded-xl shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-val-gray-dark/30">
            <h3 class="text-lg font-semibold text-val-cream">
              {{ t('bind_riot_id_title') }}
            </h3>
            <button
              class="p-1 text-val-gray hover:text-val-cream transition-colors"
              @click="close"
            >
              <div class="i-ion-close w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-5">
            <p class="text-sm text-val-gray mb-4">
              {{ t('bind_riot_id_desc') }}
            </p>

            <!-- Current binding -->
            <div v-if="authStore.user?.riotId" class="mb-4 p-3 bg-val-gray-dark/20 rounded-lg">
              <p class="text-xs text-val-gray mb-1">
                {{ t('bind_riot_id_current') }}
              </p>
              <div class="flex items-center justify-between">
                <span class="text-val-cream font-medium">{{ authStore.user.riotId }}</span>
                <button
                  class="text-xs text-val-red hover:text-val-red-glow transition-colors"
                  :disabled="loading"
                  @click="handleUnbind"
                >
                  {{ t('bind_riot_id_unbind') }}
                </button>
              </div>
            </div>

            <!-- Input -->
            <div class="space-y-2">
              <input
                v-model="riotId"
                type="text"
                :placeholder="t('bind_riot_id_placeholder')"
                class="w-full px-4 py-3 bg-val-black/50 border border-val-gray-dark/50 rounded-lg text-val-cream placeholder-val-gray/50 focus:outline-none focus:border-val-red/50 transition-colors"
                :disabled="loading"
                @keyup.enter="handleSubmit"
              >

              <!-- Error -->
              <p v-if="error" class="text-xs text-val-red">
                {{ error }}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex gap-3 px-5 py-4 border-t border-val-gray-dark/30">
            <button
              class="flex-1 btn-val-secondary rounded-lg"
              :disabled="loading"
              @click="close"
            >
              {{ t('common_cancel') }}
            </button>
            <button
              class="flex-1 btn-val py-2.5 rounded-lg text-sm"
              :disabled="loading"
              @click="handleSubmit"
            >
              <span v-if="loading" class="i-ion-reload-outline w-4 h-4 animate-spin" />
              <span v-else>{{ t('common_confirm') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
