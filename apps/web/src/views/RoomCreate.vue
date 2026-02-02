<script setup lang="ts">
import type { GameMode, RankTier, RoomListItem } from '@/api/room'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { RANK_TIERS, roomApi } from '@/api/room'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

// State
const rooms = ref<RoomListItem[]>([])
const myRoom = ref<RoomListItem | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const roomCode = ref('')
const selectedMode = ref<GameMode>('5v5')
const selectedRanks = ref<RankTier[]>([])
const creating = ref(false)

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

// Get rank range display for a room (min to max icons)
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

// Validate room code: letters + numbers, uppercase, exactly 6 chars
const roomCodeError = computed(() => {
  if (!roomCode.value)
    return ''
  if (!/^[A-Z0-9]+$/.test(roomCode.value))
    return t('room_code_invalid')
  if (roomCode.value.length !== 6)
    return t('room_code_length')
  return ''
})

const canCreate = computed(() => {
  return roomCode.value.length === 6 && !roomCodeError.value
})

// Refresh interval
let refreshInterval: ReturnType<typeof setInterval> | null = null

const gameModes: { value: GameMode, label: string }[] = [
  { value: '2v2', label: 'room_mode_2v2' },
  { value: '3v3', label: 'room_mode_3v3' },
  { value: '5v5', label: 'room_mode_5v5' },
]

// Load rooms
async function loadRooms() {
  loading.value = true
  error.value = null

  try {
    const [roomList, currentRoom] = await Promise.all([
      roomApi.listRooms(),
      roomApi.getMyRoom(),
    ])
    rooms.value = roomList
    myRoom.value = currentRoom
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    loading.value = false
  }
}

// Go to my room
function goToMyRoom() {
  if (myRoom.value) {
    router.push(`/room/${myRoom.value.room.code}`)
  }
}

// Create room
async function createRoom() {
  if (!canCreate.value)
    return

  creating.value = true
  error.value = null

  try {
    const rankTiers = selectedRanks.value.length > 0 ? selectedRanks.value : undefined
    const state = await roomApi.createRoom(roomCode.value, selectedMode.value, rankTiers)
    showCreateModal.value = false
    roomCode.value = ''
    selectedRanks.value = []
    router.push(`/room/${state.room.code}`)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
  finally {
    creating.value = false
  }
}

// Join room (click card)
async function joinRoom(code: string) {
  try {
    await roomApi.joinRoom(code)
    router.push(`/room/${code}`)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : t('unknown_error')
  }
}

// Get mode label
function getModeLabel(gameMode: GameMode): string {
  return t(`room_mode_${gameMode}`)
}

// Handle create button click
function handleCreateClick() {
  if (!authStore.isLoggedIn) {
    // 游客引导去注册
    router.push('/register')
    return
  }
  showCreateModal.value = true
}

// Lifecycle
onMounted(async () => {
  await authStore.fetchUser()
  loadRooms()
  // Auto refresh every 5 seconds
  refreshInterval = setInterval(loadRooms, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<template>
  <div class="min-h-screen">
    <!-- My Room Banner -->
    <div
      v-if="myRoom"
      class="sticky top-0 z-20 bg-val-red/90 backdrop-blur cursor-pointer hover:bg-val-red transition-colors"
      @click="goToMyRoom"
    >
      <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="i-ion-enter w-5 h-5 text-white" />
          <span class="text-white font-medium">{{ t('room_return_to_my_room') }}</span>
          <span class="text-white/80 font-mono">{{ myRoom.room.code }}</span>
        </div>
        <div class="i-ion-chevron-forward w-5 h-5 text-white" />
      </div>
    </div>

    <!-- Header -->
    <div class="sticky z-10 bg-val-dark/95 backdrop-blur border-b border-val-gray-dark/50" :class="myRoom ? 'top-[52px]' : 'top-0'">
      <div class="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 class="text-xl font-bold text-val-cream">
          {{ t('room_title') }}
        </h1>
        <button
          class="btn-val rounded-lg text-sm px-4 py-2"
          @click="handleCreateClick"
        >
          {{ t('room_create_button') }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && rooms.length === 0" class="flex items-center justify-center py-32">
      <div class="text-center">
        <div class="i-svg-spinners-ring-resize w-12 h-12 text-val-red mx-auto mb-4" />
        <p class="text-val-gray">
          {{ t('common_loading') }}
        </p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="rooms.length === 0" class="text-center py-16 px-4">
      <div class="i-ion-people w-16 h-16 text-val-gray mx-auto mb-4" />
      <p class="text-val-cream mb-2">
        {{ t('room_no_rooms') }}
      </p>
      <p class="text-val-gray text-sm mb-6">
        {{ t('room_no_rooms_desc') }}
      </p>
      <button
        class="btn-val rounded-lg"
        @click="handleCreateClick"
      >
        {{ t('room_create_first') }}
      </button>
    </div>

    <!-- Room list -->
    <div v-else class="max-w-4xl mx-auto px-4 py-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          v-for="room in rooms"
          :key="room.room.code"
          :disabled="room.room.status === 'full'"
          class="bg-val-gray-dark hover:bg-val-gray-dark/80 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg p-3 flex items-center justify-between transition-colors text-left"
          @click="joinRoom(room.room.code)"
        >
          <div class="flex items-center gap-3">
            <span class="text-white font-bold text-lg">
              {{ getModeLabel(room.room.gameMode) }}
            </span>
            <span class="text-gray-300 text-sm">
              {{ room.memberCount }} / {{ room.room.maxPlayers }}
            </span>
            <!-- Rank range display -->
            <div class="flex items-center gap-1">
              <template v-if="getRankRange(room.room.rankTiers)">
                <img
                  :src="RANK_ICONS[getRankRange(room.room.rankTiers)!.min]"
                  :alt="t(`rank_${getRankRange(room.room.rankTiers)!.min}`)"
                  class="w-5 h-5"
                >
                <template v-if="getRankRange(room.room.rankTiers)!.min !== getRankRange(room.room.rankTiers)!.max">
                  <span class="text-val-gray text-xs">-</span>
                  <img
                    :src="RANK_ICONS[getRankRange(room.room.rankTiers)!.max]"
                    :alt="t(`rank_${getRankRange(room.room.rankTiers)!.max}`)"
                    class="w-5 h-5"
                  >
                </template>
              </template>
              <span v-else class="text-val-gray text-xs">
                {{ t('room_rank_any') }}
              </span>
            </div>
          </div>
          <div class="i-ion-chevron-forward w-5 h-5 text-val-gray flex-shrink-0" />
        </button>
      </div>
    </div>

    <!-- Create Room Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/70"
          @click="showCreateModal = false"
        />

        <!-- Modal -->
        <div class="relative bg-val-dark border border-val-gray-dark rounded-lg p-6 w-full max-w-sm">
          <h2 class="text-xl font-bold text-val-cream mb-6">
            {{ t('room_create') }}
          </h2>

          <!-- Room code input -->
          <div class="mb-6">
            <label class="block text-val-gray text-sm mb-2">
              {{ t('room_code_label') }}
            </label>
            <input
              v-model="roomCode"
              type="text"
              class="w-full bg-val-gray-dark border border-val-gray-dark rounded-lg px-4 py-3 text-val-cream placeholder-val-gray focus:outline-none focus:border-val-red uppercase tracking-widest font-mono text-lg"
              :placeholder="t('room_code_placeholder')"
              maxlength="10"
              @input="roomCode = roomCode.toUpperCase()"
            >
            <p v-if="roomCodeError" class="text-val-red text-sm mt-2">
              {{ roomCodeError }}
            </p>
          </div>

          <!-- Mode selection -->
          <div class="mb-6">
            <label class="block text-val-gray text-sm mb-3">
              {{ t('room_select_mode') }}
            </label>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="mode in gameModes"
                :key="mode.value"
                class="p-4 rounded-lg border-2 transition-all" :class="[
                  selectedMode === mode.value
                    ? 'border-val-red bg-val-red/10 text-val-cream'
                    : 'border-val-gray-dark bg-val-gray-dark/50 text-val-gray hover:border-val-gray',
                ]"
                @click="selectedMode = mode.value"
              >
                <div class="text-lg font-bold">
                  {{ t(mode.label) }}
                </div>
              </button>
            </div>
          </div>

          <!-- Rank selection -->
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

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              class="flex-1 btn-val-secondary rounded-lg"
              @click="showCreateModal = false"
            >
              {{ t('common_cancel') }}
            </button>
            <button
              class="flex-1 btn-val rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="creating || !canCreate"
              @click="createRoom"
            >
              <span v-if="creating" class="i-svg-spinners-ring-resize w-5 h-5" />
              <span v-else>{{ t('room_create_button') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Error toast -->
    <div
      v-if="error"
      class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-val-red/90 text-white px-4 py-3 rounded-lg shadow-lg"
    >
      {{ error }}
    </div>
  </div>
</template>
