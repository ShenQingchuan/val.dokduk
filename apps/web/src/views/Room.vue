<script setup lang="ts">
import type { ChatMessage, RankTier, RoomEvent, RoomMember, RoomState } from '@/api/room'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { getGuestId, RANK_TIERS, roomApi } from '@/api/room'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// State
const roomState = ref<RoomState | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const chatInput = ref('')
const chatSending = ref(false)
const userReady = ref(false)
const showEditModal = ref(false)
const newRoomCode = ref('')
const selectedRanks = ref<RankTier[]>([])
const updatingSettings = ref(false)

// Rank tier icons from Valorant API
const RANK_ICONS: Record<RankTier, string> = {
  iron: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/3/largeicon.png',
  bronze: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/6/largeicon.png',
  silver: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/9/largeicon.png',
  gold: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/12/largeicon.png',
  platinum: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/15/largeicon.png',
  diamond: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/18/largeicon.png',
  ascendant: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/21/largeicon.png',
  immortal: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/24/largeicon.png',
  radiant: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/27/largeicon.png',
}

// Range selection state
const rangeStart = ref<RankTier | null>(null)

// Handle rank click for range selection
function handleRankClick(rank: RankTier) {
  if (rangeStart.value === null) {
    // First click: set as range start
    rangeStart.value = rank
    selectedRanks.value = [rank]
  }
  else if (rangeStart.value === rank) {
    // Clicked same rank: reset selection
    rangeStart.value = null
    selectedRanks.value = []
  }
  else {
    // Second click: select range from start to this rank
    const startIdx = RANK_TIERS.indexOf(rangeStart.value)
    const endIdx = RANK_TIERS.indexOf(rank)
    const minIdx = Math.min(startIdx, endIdx)
    const maxIdx = Math.max(startIdx, endIdx)
    selectedRanks.value = RANK_TIERS.slice(minIdx, maxIdx + 1) as unknown as RankTier[]
    rangeStart.value = null // Reset for next selection
  }
}

// Clear rank selection
function clearRanks() {
  rangeStart.value = null
  selectedRanks.value = []
}

// Get rank range display
function getRankRange(rankTiers?: RankTier[]): { min: RankTier, max: RankTier } | null {
  if (!rankTiers || rankTiers.length === 0)
    return null

  const sorted = [...rankTiers].sort((a, b) => RANK_TIERS.indexOf(a) - RANK_TIERS.indexOf(b))
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  if (!min || !max)
    return null

  return { min, max }
}

// SSE unsubscribe function
let unsubscribe: (() => void) | null = null

// Computed
const roomCode = computed(() => (route.params.code as string)?.toUpperCase())
const currentUserId = computed(() => authStore.user?.id || getGuestId())
const isOwner = computed(() => roomState.value?.room.ownerId === currentUserId.value)
const isFull = computed(() => roomState.value?.room.status === 'full')
const memberCount = computed(() => roomState.value?.members.length ?? 0)
const maxPlayers = computed(() => roomState.value?.room.maxPlayers ?? 5)

// Chat container ref for auto-scroll
const chatContainer = ref<HTMLElement | null>(null)

// Format timestamp
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// Load room state
async function loadRoom() {
  if (!roomCode.value)
    return

  loading.value = true
  error.value = null

  try {
    roomState.value = await roomApi.getRoomState(roomCode.value)
    subscribeToEvents()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
    roomState.value = null
  }
  finally {
    loading.value = false
  }
}

// Subscribe to SSE events
function subscribeToEvents() {
  if (!roomCode.value)
    return

  // Cleanup existing subscription
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }

  unsubscribe = roomApi.subscribeEvents(
    roomCode.value,
    handleEvent,
    () => {
      // On error, try to reconnect after 3 seconds
      setTimeout(() => {
        if (roomCode.value) {
          subscribeToEvents()
        }
      }, 3000)
    },
  )
}

// Handle SSE events
function handleEvent(event: RoomEvent) {
  if (!roomState.value)
    return

  switch (event.type) {
    case 'member_join': {
      const member = event.data as RoomMember
      // Check if member already exists
      if (!roomState.value.members.find(m => m.odId === member.odId)) {
        roomState.value.members.push(member)
        // Update room status if full
        if (roomState.value.members.length >= roomState.value.room.maxPlayers) {
          roomState.value.room.status = 'full'
        }
      }
      break
    }
    case 'member_leave': {
      const { odId } = event.data as { odId: string }
      roomState.value.members = roomState.value.members.filter(m => m.odId !== odId)
      // Update room status
      if (roomState.value.room.status === 'full') {
        roomState.value.room.status = 'waiting'
      }
      break
    }
    case 'chat': {
      const message = event.data as ChatMessage
      // Check if message already exists
      if (!roomState.value.chat.find(m => m.id === message.id)) {
        roomState.value.chat.push(message)
        // Auto scroll to bottom
        setTimeout(() => {
          if (chatContainer.value) {
            chatContainer.value.scrollTop = chatContainer.value.scrollHeight
          }
        }, 0)
      }
      break
    }
    case 'room_closed': {
      const { reason } = event.data as { reason: string }
      if (reason === 'empty') {
        error.value = t('room_closed')
        roomState.value = null
      }
      break
    }
    case 'owner_change': {
      const { newOwnerId } = event.data as { newOwnerId: string }
      roomState.value.room.ownerId = newOwnerId
      break
    }
  }
}

// Join room (also used for initial load - joinRoom returns state if already in room)
async function joinRoom() {
  if (!roomCode.value)
    return

  loading.value = true
  error.value = null

  try {
    roomState.value = await roomApi.joinRoom(roomCode.value)
    subscribeToEvents()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    loading.value = false
  }
}

// Leave room
async function leaveRoom() {
  if (!roomCode.value)
    return

  // 先清理状态，避免闪烁
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  roomState.value = null
  error.value = null

  try {
    await roomApi.leaveRoom(roomCode.value)
  }
  catch {
    // 忽略离开房间的错误
  }
  finally {
    router.push('/room')
  }
}

// Kick member
async function kickMember(targetId: string) {
  if (!roomCode.value || !isOwner.value)
    return

  try {
    await roomApi.kickMember(roomCode.value, targetId)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
}

// Reset room
async function resetRoom() {
  if (!roomCode.value || !isOwner.value)
    return

  try {
    roomState.value = await roomApi.resetRoom(roomCode.value)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
}

// Open edit modal
function openEditModal() {
  if (!isOwner.value)
    return
  newRoomCode.value = roomState.value?.room.code || ''
  selectedRanks.value = [...(roomState.value?.room.rankTiers || [])]
  rangeStart.value = null
  showEditModal.value = true
}

// Validate new room code
const newCodeError = computed(() => {
  if (!newRoomCode.value)
    return ''
  if (!/^[A-Z0-9]+$/.test(newRoomCode.value))
    return t('room_code_invalid')
  if (newRoomCode.value.length !== 6)
    return t('room_code_length')
  return ''
})

// Check if settings have changed
const hasSettingsChanged = computed(() => {
  if (!roomState.value)
    return false
  const codeChanged = newRoomCode.value !== roomState.value.room.code
  const currentRanks = roomState.value.room.rankTiers || []
  const ranksChanged = selectedRanks.value.length !== currentRanks.length
    || selectedRanks.value.some(r => !currentRanks.includes(r))
  return codeChanged || ranksChanged
})

const canUpdateSettings = computed(() => {
  return newRoomCode.value.length === 6
    && !newCodeError.value
    && hasSettingsChanged.value
})

// Update room settings
async function updateRoomSettings() {
  if (!roomCode.value || !canUpdateSettings.value)
    return

  updatingSettings.value = true

  try {
    const newCode = newRoomCode.value !== roomState.value?.room.code ? newRoomCode.value : undefined
    const state = await roomApi.updateRoomSettings(roomCode.value, {
      newCode,
      rankTiers: selectedRanks.value,
    })
    roomState.value = state
    showEditModal.value = false
    // 更新 URL（如果房间码变了）
    if (newCode) {
      router.replace(`/room/${state.room.code}`)
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    updatingSettings.value = false
  }
}

// Send chat message
async function sendChat() {
  if (!roomCode.value || !chatInput.value.trim())
    return

  chatSending.value = true

  try {
    await roomApi.sendChat(roomCode.value, chatInput.value.trim())
    chatInput.value = ''
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    chatSending.value = false
  }
}

// Copy room code to clipboard
async function copyRoomCode() {
  if (!roomCode.value)
    return

  try {
    await navigator.clipboard.writeText(roomCode.value)
    // Could show a toast here
  }
  catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = roomCode.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

// Check if current user is in room
const isInRoom = computed(() => {
  if (!roomState.value || !userReady.value)
    return false
  const inRoom = roomState.value.members.some(m => m.odId === currentUserId.value)
  return inRoom
})

// Lifecycle
onMounted(async () => {
  // 确保用户状态已加载
  await authStore.fetchUser()
  userReady.value = true
  if (roomCode.value) {
    joinRoom()
  }
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

watch(roomCode, (newCode) => {
  if (newCode) {
    joinRoom()
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center py-32">
      <div class="text-center">
        <div class="i-svg-spinners-ring-resize w-12 h-12 text-val-red mx-auto mb-4" />
        <p class="text-val-gray">
          {{ t('common_loading') }}
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error && !roomState" class="flex-1 flex items-center justify-center py-16">
      <div class="text-center">
        <div class="i-ion-alert-circle w-12 h-12 text-val-red mx-auto mb-3" />
        <p class="text-val-cream mb-2">
          {{ error }}
        </p>
        <button class="btn-val-outline mt-4" @click="loadRoom">
          {{ t('common_retry') }}
        </button>
      </div>
    </div>

    <!-- Room Content -->
    <template v-else-if="roomState">
      <!-- Sticky Header - Actions -->
      <div class="sticky top-0 z-20 bg-val-dark/95 backdrop-blur border-b border-val-gray-dark/50">
        <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Rank range display -->
            <div class="flex items-center gap-1">
              <template v-if="getRankRange(roomState.room.rankTiers)">
                <img
                  :src="RANK_ICONS[getRankRange(roomState.room.rankTiers)!.min]"
                  :alt="t(`rank_${getRankRange(roomState.room.rankTiers)!.min}`)"
                  class="w-5 h-5"
                >
                <template v-if="getRankRange(roomState.room.rankTiers)!.min !== getRankRange(roomState.room.rankTiers)!.max">
                  <span class="text-val-gray text-xs">-</span>
                  <img
                    :src="RANK_ICONS[getRankRange(roomState.room.rankTiers)!.max]"
                    :alt="t(`rank_${getRankRange(roomState.room.rankTiers)!.max}`)"
                    class="w-5 h-5"
                  >
                </template>
              </template>
              <span v-else class="text-val-gray text-xs">
                {{ t('room_rank_any') }}
              </span>
            </div>
            <span class="font-mono text-lg text-val-cream tracking-wider">{{ roomState.room.code }}</span>
            <button
              class="text-val-gray hover:text-val-cream transition-colors"
              :title="t('room_copy_code')"
              @click="copyRoomCode"
            >
              <div class="i-lucide-copy w-4 h-4" />
            </button>
            <button
              v-if="isOwner"
              class="text-val-gray hover:text-val-cream transition-colors"
              :title="t('room_edit_settings')"
              @click="openEditModal"
            >
              <div class="i-lucide-pencil w-4 h-4" />
            </button>
          </div>
          <!-- Actions: icon on mobile, text on desktop -->
          <div class="flex items-center gap-5">
            <!-- Reset: icon on mobile -->
            <button
              v-if="isOwner"
              class="md:hidden text-val-gray hover:text-val-cream transition-colors"
              :title="t('room_reset')"
              @click="resetRoom"
            >
              <div class="i-lucide-refresh-cw w-5 h-5" />
            </button>
            <!-- Reset: text on desktop -->
            <button
              v-if="isOwner"
              class="hidden md:block px-3 py-1.5 text-sm text-val-gray hover:text-val-cream border border-val-gray-dark rounded hover:border-val-gray transition-colors"
              @click="resetRoom"
            >
              {{ t('room_reset') }}
            </button>
            <!-- Leave: icon on mobile -->
            <button
              class="md:hidden text-val-red hover:text-val-red/80 transition-colors"
              :title="t('room_leave')"
              @click="leaveRoom"
            >
              <div class="i-lucide-log-out w-5 h-5" />
            </button>
            <!-- Leave: text on desktop -->
            <button
              class="hidden md:block px-3 py-1.5 text-sm text-val-red border border-val-red/50 rounded hover:bg-val-red/10 transition-colors"
              @click="leaveRoom"
            >
              {{ t('room_leave') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full pb-20">
        <!-- Room Info -->
        <div class="bg-val-gray-dark rounded-lg p-4 mb-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-white">
                {{ t('room_mode') }} {{ t(`room_mode_${roomState.room.gameMode}`) }}
              </span>
              <span
                class="px-2 py-1 rounded text-xs font-medium whitespace-nowrap" :class="[
                  isFull ? 'bg-val-red/20 text-val-red' : 'bg-green-500/20 text-green-400',
                ]"
              >
                {{ isFull ? t('room_full') : t('room_waiting') }}
              </span>
            </div>
            <span class="text-val-gray">
              {{ memberCount }} / {{ maxPlayers }}
            </span>
          </div>
        </div>

        <!-- Members List -->
        <div class="bg-val-gray-dark rounded-lg p-4 mb-4">
          <h3 class="text-val-cream font-medium mb-3">
            {{ t('room_members') }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="member in roomState.members"
              :key="member.odId"
              class="flex items-center justify-between p-2 rounded bg-val-dark/50"
            >
              <div class="flex items-center gap-2">
                <div class="i-ion-person w-5 h-5 text-val-gray" />
                <span class="text-val-cream">{{ member.username }}</span>
                <span v-if="member.odId === roomState.room.ownerId" class="text-xs text-val-red">
                  {{ t('room_owner') }}
                </span>
              </div>
              <button
                v-if="isOwner && member.odId !== currentUserId"
                class="p-1 text-val-gray hover:text-val-red transition-colors"
                :title="t('room_kick')"
                @click="kickMember(member.odId)"
              >
                <div class="i-ion-close w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Chat Messages -->
        <div class="bg-val-gray-dark rounded-lg p-4">
          <h3 class="text-val-cream font-medium mb-3">
            {{ t('room_chat') }}
          </h3>
          <div
            ref="chatContainer"
            class="min-h-32 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-val-gray-dark scrollbar-track-transparent"
          >
            <div v-if="roomState.chat.length === 0" class="text-val-gray text-sm text-center py-8">
              {{ t('room_no_messages') }}
            </div>
            <div
              v-for="msg in roomState.chat"
              :key="msg.id"
              class="text-sm"
            >
              <span class="text-val-gray text-xs mr-2">{{ formatTime(msg.timestamp) }}</span>
              <span class="text-val-cream font-medium">{{ msg.username }}:</span>
              <span class="text-gray-400 ml-2">{{ msg.content }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky Footer - Chat Input -->
      <div class="sticky bottom-0 z-20 bg-val-dark/95 backdrop-blur border-t border-val-gray-dark/50">
        <div class="max-w-2xl mx-auto px-4 py-3">
          <form class="flex gap-2" @submit.prevent="sendChat">
            <input
              v-model="chatInput"
              type="text"
              :placeholder="t('room_chat_placeholder')"
              :disabled="!isInRoom"
              class="flex-1 px-3 py-2 bg-val-gray-dark rounded text-val-cream placeholder-val-gray focus:outline-none focus:ring-1 focus:ring-val-red disabled:opacity-50"
              maxlength="500"
            >
            <button
              type="submit"
              :disabled="!chatInput.trim() || chatSending || !isInRoom"
              class="px-4 py-2 whitespace-nowrap bg-val-red text-white rounded hover:bg-val-red/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ t('room_send') }}
            </button>
          </form>
        </div>
      </div>
    </template>

    <!-- Error toast -->
    <div
      v-if="error && roomState"
      class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-val-red/90 text-white px-4 py-3 rounded-lg shadow-lg"
    >
      {{ error }}
    </div>

    <!-- Edit Room Settings Modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/70"
          @click="showEditModal = false"
        />
        <div class="relative bg-val-dark border border-val-gray-dark rounded-lg p-6 w-full max-w-sm">
          <h2 class="text-xl font-bold text-val-cream mb-6">
            {{ t('room_edit_settings') }}
          </h2>

          <!-- Room Code -->
          <div class="mb-6">
            <label class="block text-val-gray text-sm mb-2">
              {{ t('room_code_label') }}
            </label>
            <input
              v-model="newRoomCode"
              type="text"
              class="w-full bg-val-gray-dark border border-val-gray-dark rounded-lg px-4 py-3 text-val-cream placeholder-val-gray focus:outline-none focus:border-val-red uppercase tracking-widest font-mono text-lg"
              maxlength="6"
              @input="newRoomCode = newRoomCode.toUpperCase()"
            >
            <p v-if="newCodeError" class="text-val-red text-sm mt-2">
              {{ newCodeError }}
            </p>
          </div>

          <!-- Rank Selection -->
          <div class="mb-6">
            <label class="block text-val-gray text-sm mb-3">
              {{ t('room_select_rank') }}
              <span class="text-val-gray/60 ml-1">({{ t('room_rank_optional') }})</span>
            </label>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="rank in RANK_TIERS"
                :key="rank"
                type="button"
                class="p-2 rounded-lg border-2 transition-all flex flex-col items-center" :class="[
                  selectedRanks.includes(rank)
                    ? 'border-val-red bg-val-red/10'
                    : rangeStart === rank
                      ? 'border-val-red/50 bg-val-red/5'
                      : 'border-val-gray-dark bg-val-gray-dark/50 hover:border-val-gray',
                ]"
                :title="t(`rank_${rank}`)"
                @click="handleRankClick(rank)"
              >
                <img
                  :src="RANK_ICONS[rank]"
                  :alt="t(`rank_${rank}`)"
                  class="w-8 h-8"
                >
              </button>
            </div>
            <p v-if="rangeStart && selectedRanks.length === 1" class="text-val-gray text-xs mt-2">
              {{ t('room_rank_select_end') }}
            </p>
            <p v-else-if="selectedRanks.length > 0" class="text-val-gray text-xs mt-2 flex items-center gap-1">
              {{ t('room_rank_selected') }}:
              <img :src="RANK_ICONS[getRankRange(selectedRanks)!.min]" class="w-4 h-4 inline">
              <template v-if="getRankRange(selectedRanks)!.min !== getRankRange(selectedRanks)!.max">
                -
                <img :src="RANK_ICONS[getRankRange(selectedRanks)!.max]" class="w-4 h-4 inline">
              </template>
              <button type="button" class="ml-2 text-val-red hover:underline" @click="clearRanks">
                {{ t('common_clear') }}
              </button>
            </p>
          </div>

          <div class="flex gap-3">
            <button
              class="flex-1 btn-val-secondary rounded-lg"
              @click="showEditModal = false"
            >
              {{ t('common_cancel') }}
            </button>
            <button
              class="flex-1 btn-val rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="updatingSettings || !canUpdateSettings"
              @click="updateRoomSettings"
            >
              <span v-if="updatingSettings" class="i-svg-spinners-ring-resize w-5 h-5" />
              <span v-else>{{ t('common_confirm') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
