<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { valorantApi } from '@/api/valorant'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const matchId = computed(() => route.params.matchId as string)

// Henrik API v2 match response type
interface V2MatchData {
  metadata: {
    map: string
    game_version: string
    game_length: number // seconds
    game_start: number // unix timestamp
    game_start_patched: string
    rounds_played: number
    mode: string
    mode_id: string
    queue: string
    season_id: string
    platform: string
    matchid: string
    region: string
    cluster: string
  }
  players: {
    all_players: V2Player[]
    red: V2Player[]
    blue: V2Player[]
  }
  teams: {
    red: { has_won: boolean, rounds_won: number, rounds_lost: number }
    blue: { has_won: boolean, rounds_won: number, rounds_lost: number }
  }
  rounds: V2Round[]
}

interface V2Player {
  puuid: string
  name: string
  tag: string
  team: string
  level: number
  character: string
  currenttier: number
  currenttier_patched: string
  player_card: string
  player_title: string
  party_id: string
  assets: {
    card: { small: string, large: string, wide: string }
    agent: { small: string, bust: string, full: string, killfeed: string }
  }
  stats: {
    score: number
    kills: number
    deaths: number
    assists: number
    bodyshots: number
    headshots: number
    legshots: number
  }
  damage_made: number
  damage_received: number
}

interface V2Round {
  winning_team: string
  end_type: string
  bomb_planted: boolean
  bomb_defused: boolean
}

const match = ref<V2MatchData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Fetch match data
onMounted(async () => {
  try {
    match.value = await valorantApi.getMatch(matchId.value) as unknown as V2MatchData
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load match'
  }
  finally {
    loading.value = false
  }
})

// Team A = Blue, Team B = Red
const teamA = computed(() => {
  if (!match.value?.players?.all_players)
    return []
  return match.value.players.all_players
    .filter(p => p.team.toLowerCase() === 'blue')
    .sort((a, b) => b.stats.score - a.stats.score)
})

const teamB = computed(() => {
  if (!match.value?.players?.all_players)
    return []
  return match.value.players.all_players
    .filter(p => p.team.toLowerCase() === 'red')
    .sort((a, b) => b.stats.score - a.stats.score)
})

// Teams data
const teamAData = computed(() => match.value?.teams?.blue)
const teamBData = computed(() => match.value?.teams?.red)

// Map name translation (v2: map is a string)
const translatedMap = computed(() => {
  const mapName = match.value?.metadata.map?.toLowerCase()
  if (!mapName)
    return match.value?.metadata.map || 'Unknown'
  const mapKey = `map_${mapName}`
  const translated = t(mapKey)
  return translated === mapKey ? match.value?.metadata.map : translated
})

// Mode translation (v2: mode is a string)
const translatedMode = computed(() => {
  const mode = match.value?.metadata.mode?.toLowerCase().replace(/\s+/g, '')
  if (!mode)
    return match.value?.metadata.mode || 'Unknown'
  const modeKey = `mode_${mode}`
  const translated = t(modeKey)
  return translated === modeKey ? match.value?.metadata.mode : translated
})

// Format game duration (v2: game_length is in seconds)
const gameDuration = computed(() => {
  if (!match.value)
    return ''
  const seconds = match.value.metadata.game_length
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
})

// Format date (v2: game_start is unix timestamp)
const matchDate = computed(() => {
  if (!match.value)
    return ''
  return new Date(match.value.metadata.game_start * 1000).toLocaleDateString()
})

// Calculate player stats
function getKDA(player: V2Player): string {
  return `${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}`
}

function getKDRatio(player: V2Player): string {
  const kd = player.stats.deaths === 0 ? player.stats.kills : player.stats.kills / player.stats.deaths
  return kd.toFixed(2)
}

function getHeadshotPercent(player: V2Player): number {
  const total = player.stats.headshots + player.stats.bodyshots + player.stats.legshots
  if (total === 0)
    return 0
  return Math.round((player.stats.headshots / total) * 100)
}

function getACS(player: V2Player): number {
  const totalRounds = match.value?.metadata.rounds_played ?? 0
  if (totalRounds === 0)
    return 0
  return Math.round(player.stats.score / totalRounds)
}

// Translate rank (e.g., "Platinum 1" -> "铂金 1")
function translateRank(rankPatched: string | null | undefined): string {
  if (!rankPatched)
    return t('player_unranked') || 'Unranked'

  // Map English rank names to i18n keys
  const rankMap: Record<string, string> = {
    iron: 'rank_iron',
    bronze: 'rank_bronze',
    silver: 'rank_silver',
    gold: 'rank_gold',
    platinum: 'rank_platinum',
    diamond: 'rank_diamond',
    ascendant: 'rank_ascendant',
    immortal: 'rank_immortal',
    radiant: 'rank_radiant',
  }

  // Parse rank string (e.g., "Platinum 1" or "Radiant")
  const match = rankPatched.match(/^(\w+)(?:\s+(\d+))?$/)
  if (!match)
    return rankPatched

  const [, rankName, tier] = match
  const rankKey = rankMap[rankName?.toLowerCase() ?? '']

  if (!rankKey)
    return rankPatched

  const translatedRank = t(rankKey)
  if (translatedRank === rankKey)
    return rankPatched

  return tier ? `${translatedRank} ${tier}` : translatedRank
}

// Check if Team A (Blue) won this round
function isTeamAWin(round: V2Round): boolean {
  return round.winning_team.toLowerCase() === 'blue'
}

// Check if round was won by defuse
function isDefuseWin(round: V2Round): boolean {
  return round.bomb_defused || round.end_type.toLowerCase().includes('defuse')
}

function getRoundEndType(round: V2Round): string {
  const endType = round.end_type.toLowerCase()
  if (endType.includes('elim'))
    return t('round_eliminated') || 'Eliminated'
  if (endType.includes('defuse'))
    return t('round_defused') || 'Defused'
  if (endType.includes('detonate'))
    return t('round_detonated') || 'Detonated'
  if (endType.includes('time'))
    return t('round_timeout') || 'Time'
  return round.end_type
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
  <div class="min-h-screen">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-32">
      <div class="text-center">
        <div class="i-svg-spinners-ring-resize w-12 h-12 text-val-red mx-auto mb-4" />
        <p class="text-val-gray">
          {{ t('match_detail_loading') || 'Loading match details...' }}
        </p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="px-4 py-32">
      <div class="text-center max-w-md mx-auto">
        <div class="w-20 h-20 mx-auto mb-6 relative">
          <svg class="w-full h-full text-val-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="text-val-red mb-6">
          {{ error }}
        </p>
        <button class="btn-val rounded-lg" @click="goBack">
          {{ t('common_back') || 'Go Back' }}
        </button>
      </div>
    </div>

    <!-- Match Content -->
    <div v-else-if="match" class="pb-8">
      <!-- Match Header -->
      <div class="relative bg-val-darker border-b border-val-gray-dark/30">
        <div class="max-w-6xl mx-auto px-4 md:px-8 py-6">
          <!-- Back button + Title -->
          <div class="flex items-center gap-4 mb-6">
            <button class="p-2 -ml-2 text-val-gray hover:text-val-cream transition-colors" @click="goBack">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 class="text-xl md:text-2xl font-bold text-val-cream">
                {{ t('match_detail_title') || 'Match Details' }}
              </h1>
              <p class="text-val-gray text-sm">
                {{ translatedMap }} · {{ translatedMode }} · {{ matchDate }}
              </p>
            </div>
          </div>

          <!-- Score Display -->
          <div class="flex items-center justify-center gap-6 md:gap-12">
            <!-- Team A -->
            <div class="text-center">
              <p class="text-sm text-blue-400 uppercase font-medium mb-2">
                {{ t('team_a') || 'Team A' }}
              </p>
              <p class="text-4xl md:text-6xl font-bold" :class="teamAData?.has_won ? 'text-blue-400' : 'text-val-gray'">
                {{ teamAData?.rounds_won ?? 0 }}
              </p>
            </div>

            <!-- VS -->
            <div class="text-val-gray text-lg md:text-2xl font-medium">
              vs
            </div>

            <!-- Team B -->
            <div class="text-center">
              <p class="text-sm text-val-red uppercase font-medium mb-2">
                {{ t('team_b') || 'Team B' }}
              </p>
              <p class="text-4xl md:text-6xl font-bold" :class="teamBData?.has_won ? 'text-val-red' : 'text-val-gray'">
                {{ teamBData?.rounds_won ?? 0 }}
              </p>
            </div>
          </div>

          <!-- Game Duration -->
          <p class="text-center text-val-gray text-sm mt-4">
            {{ t('match_duration') || 'Duration' }}: {{ gameDuration }}
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div class="max-w-6xl mx-auto px-4 md:px-8 mt-6 space-y-6">
        <!-- Round Timeline Grid -->
        <div v-if="match.rounds && match.rounds.length > 0" class="card-val p-4">
          <h3 class="text-sm font-medium text-val-gray uppercase tracking-wider mb-4">
            {{ t('round_timeline') || 'Round Timeline' }}
          </h3>

          <!-- Grid: 2 rows (Team A / Team B), N columns (rounds) -->
          <div class="overflow-x-auto overflow-y-visible">
            <div class="inline-flex flex-col gap-1 min-w-max py-2">
              <!-- Team A row -->
              <div class="flex items-center gap-1">
                <span class="w-16 text-xs text-blue-400 font-medium shrink-0">{{ t('team_a') || 'Team A' }}</span>
                <div class="flex gap-1">
                  <template v-for="(round, index) in match.rounds" :key="`a-${index}`">
                    <!-- Half-time separator before round 13 -->
                    <div
                      v-if="index === 12"
                      class="flex flex-col items-center justify-center px-1"
                    >
                      <div class="w-px h-full bg-gradient-to-b from-transparent via-val-cream/50 to-transparent" />
                    </div>

                    <div class="group relative">
                      <!-- Team A cell - show icon if won, empty if lost -->
                      <div
                        class="w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center transition-transform hover:scale-110"
                        :class="isTeamAWin(round) ? 'bg-blue-500/80' : 'bg-val-gray-dark/30'"
                        :title="`R${index + 1}: ${getRoundEndType(round)}`"
                      >
                        <template v-if="isTeamAWin(round)">
                          <div
                            v-if="isDefuseWin(round)"
                            class="i-material-symbols-tools-pliers-wire-stripper w-4 h-4 text-white"
                          />
                          <div v-else class="i-material-symbols-flag w-4 h-4 text-white" />
                        </template>
                      </div>

                      <!-- Tooltip -->
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-val-black text-val-cream text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        R{{ index + 1 }}: {{ getRoundEndType(round) }}
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Half-time label row -->
              <div v-if="match.rounds.length > 12" class="flex items-center gap-1">
                <span class="w-16 shrink-0" />
                <div class="flex gap-1">
                  <!-- First half spacer (12 rounds) -->
                  <div class="flex gap-1">
                    <div v-for="i in 12" :key="`spacer1-${i}`" class="w-7 md:w-8" />
                  </div>
                  <!-- Half-time indicator -->
                  <div class="flex flex-col items-center justify-center px-1 translate-x--1/3">
                    <span class="text-[10px] text-val-cream/60 font-medium tracking-wider whitespace-nowrap rotate-0">HALF</span>
                  </div>
                </div>
              </div>

              <!-- Team B row -->
              <div class="flex items-center gap-1">
                <span class="w-16 text-xs text-val-red font-medium shrink-0">{{ t('team_b') || 'Team B' }}</span>
                <div class="flex gap-1">
                  <template v-for="(round, index) in match.rounds" :key="`b-${index}`">
                    <!-- Half-time separator before round 13 -->
                    <div
                      v-if="index === 12"
                      class="flex flex-col items-center justify-center px-1"
                    >
                      <div class="w-px h-full bg-gradient-to-b from-transparent via-val-cream/50 to-transparent" />
                    </div>

                    <div class="group relative">
                      <!-- Team B cell - show icon if won, empty if lost -->
                      <div
                        class="w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center transition-transform hover:scale-110"
                        :class="!isTeamAWin(round) ? 'bg-val-red/80' : 'bg-val-gray-dark/30'"
                        :title="`R${index + 1}: ${getRoundEndType(round)}`"
                      >
                        <template v-if="!isTeamAWin(round)">
                          <div
                            v-if="isDefuseWin(round)"
                            class="i-material-symbols-tools-pliers-wire-stripper w-4 h-4 text-white"
                          />
                          <div v-else class="i-material-symbols-flag w-4 h-4 text-white" />
                        </template>
                      </div>

                      <!-- Tooltip -->
                      <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-val-black text-val-cream text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        R{{ index + 1 }}: {{ getRoundEndType(round) }}
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Round numbers -->
              <div class="flex items-center gap-1 mt-1">
                <span class="w-16 shrink-0" />
                <div class="flex gap-1">
                  <template v-for="(_, index) in match.rounds" :key="`num-${index}`">
                    <!-- Half-time spacer -->
                    <div v-if="index === 12" class="px-1">
                      <div class="w-px" />
                    </div>
                    <div class="w-7 h-4 md:w-8 text-center text-xs text-val-gray">
                      {{ index + 1 }}
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Legend -->
          <div class="flex items-center gap-4 mt-4 text-xs text-val-gray">
            <div class="flex items-center gap-0.5">
              <div class="i-material-symbols-tools-pliers-wire-stripper w-4 h-4" />
              <span>{{ t('round_defused') || 'Defused' }}</span>
            </div>
            <div class="flex items-center gap-1">
              <div class="i-material-symbols-flag w-4 h-4" />
              <span>{{ t('round_eliminated') || 'Eliminated' }} / {{ t('round_detonated') || 'Detonated' }}</span>
            </div>
          </div>
        </div>

        <!-- Team A Table -->
        <div class="card-val overflow-hidden">
          <div class="bg-blue-500/10 px-4 py-3 border-b border-val-gray-dark/30">
            <div class="flex items-center justify-between">
              <h3 class="text-blue-400 font-medium uppercase">
                {{ t('team_a') || 'Team A' }}
              </h3>
              <span class="text-blue-400 font-bold">{{ teamAData?.rounds_won ?? 0 }}</span>
            </div>
          </div>

          <!-- Desktop Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full">
              <thead class="bg-val-darker">
                <tr class="text-xs text-val-gray uppercase">
                  <th class="px-4 py-3 text-left">
                    {{ t('player') || 'Player' }}
                  </th>
                  <th class="px-4 py-3 text-center">
                    {{ t('rank') || 'Rank' }}
                  </th>
                  <th class="px-4 py-3 text-center">
                    ACS
                  </th>
                  <th class="px-4 py-3 text-center">
                    K/D/A
                  </th>
                  <th class="px-4 py-3 text-center">
                    K/D
                  </th>
                  <th class="px-4 py-3 text-center">
                    HS%
                  </th>
                  <th class="px-4 py-3 text-center">
                    {{ t('damage') || 'DMG' }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="player in teamA"
                  :key="player.puuid"
                  class="border-t border-val-gray-dark/30 hover:bg-val-darker/50 transition-colors"
                >
                  <td class="px-4 py-3 w-64">
                    <div class="flex items-center gap-3">
                      <img
                        :src="player.assets.agent.small"
                        :alt="player.character"
                        class="w-10 h-10 rounded bg-val-darker shrink-0"
                      >
                      <div class="min-w-0">
                        <p class="text-val-cream font-medium truncate max-w-full" :title="player.name">
                          {{ player.name }}
                        </p>
                        <p class="text-xs text-val-gray">
                          #{{ player.tag }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="text-val-gray text-sm">{{ translateRank(player.currenttier_patched) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ getACS(player) }}
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ getKDA(player) }}
                  </td>
                  <td class="px-4 py-3 text-center font-mono" :class="Number(getKDRatio(player)) >= 1 ? 'text-green-400' : 'text-val-red'">
                    {{ getKDRatio(player) }}
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ getHeadshotPercent(player) }}%
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ player.damage_made }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards -->
          <div class="md:hidden divide-y divide-val-gray-dark/30">
            <div
              v-for="player in teamA"
              :key="player.puuid"
              class="p-4"
            >
              <div class="flex items-center gap-3 mb-3">
                <img
                  :src="player.assets.agent.small"
                  :alt="player.character"
                  class="w-12 h-12 rounded bg-val-darker shrink-0"
                >
                <div class="flex-1 min-w-0">
                  <p class="text-val-cream font-medium truncate" :title="player.name">
                    {{ player.name }}
                  </p>
                  <p class="text-xs text-val-gray truncate">
                    #{{ player.tag }} · {{ translateRank(player.currenttier_patched) }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-mono text-val-cream font-bold">
                    {{ getKDA(player) }}
                  </p>
                  <p class="text-xs" :class="Number(getKDRatio(player)) >= 1 ? 'text-green-400' : 'text-val-red'">
                    {{ getKDRatio(player) }} K/D
                  </p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center text-xs">
                <div class="bg-val-darker rounded p-2">
                  <p class="text-val-gray">
                    ACS
                  </p>
                  <p class="text-val-cream font-mono">
                    {{ getACS(player) }}
                  </p>
                </div>
                <div class="bg-val-darker rounded p-2">
                  <p class="text-val-gray">
                    HS%
                  </p>
                  <p class="text-val-cream font-mono">
                    {{ getHeadshotPercent(player) }}%
                  </p>
                </div>
                <div class="bg-val-darker rounded p-2">
                  <p class="text-val-gray">
                    DMG
                  </p>
                  <p class="text-val-cream font-mono">
                    {{ player.damage_made }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Team B Table -->
        <div class="card-val overflow-hidden">
          <div class="bg-val-red/10 px-4 py-3 border-b border-val-gray-dark/30">
            <div class="flex items-center justify-between">
              <h3 class="text-val-red font-medium uppercase">
                {{ t('team_b') || 'Team B' }}
              </h3>
              <span class="text-val-red font-bold">{{ teamBData?.rounds_won ?? 0 }}</span>
            </div>
          </div>

          <!-- Desktop Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full">
              <thead class="bg-val-darker">
                <tr class="text-xs text-val-gray uppercase">
                  <th class="px-4 py-3 text-left">
                    {{ t('player') || 'Player' }}
                  </th>
                  <th class="px-4 py-3 text-center">
                    {{ t('rank') || 'Rank' }}
                  </th>
                  <th class="px-4 py-3 text-center">
                    ACS
                  </th>
                  <th class="px-4 py-3 text-center">
                    K/D/A
                  </th>
                  <th class="px-4 py-3 text-center">
                    K/D
                  </th>
                  <th class="px-4 py-3 text-center">
                    HS%
                  </th>
                  <th class="px-4 py-3 text-center">
                    {{ t('damage') || 'DMG' }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="player in teamB"
                  :key="player.puuid"
                  class="border-t border-val-gray-dark/30 hover:bg-val-darker/50 transition-colors"
                >
                  <td class="px-4 py-3 w-64">
                    <div class="flex items-center gap-3">
                      <img
                        :src="player.assets.agent.small"
                        :alt="player.character"
                        class="w-10 h-10 rounded bg-val-darker shrink-0"
                      >
                      <div class="min-w-0">
                        <p class="text-val-cream font-medium truncate max-w-32" :title="player.name">
                          {{ player.name }}
                        </p>
                        <p class="text-xs text-val-gray">
                          #{{ player.tag }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="text-val-gray text-sm">{{ translateRank(player.currenttier_patched) }}</span>
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ getACS(player) }}
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ getKDA(player) }}
                  </td>
                  <td class="px-4 py-3 text-center font-mono" :class="Number(getKDRatio(player)) >= 1 ? 'text-green-400' : 'text-val-red'">
                    {{ getKDRatio(player) }}
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ getHeadshotPercent(player) }}%
                  </td>
                  <td class="px-4 py-3 text-center font-mono text-val-cream">
                    {{ player.damage_made }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards -->
          <div class="md:hidden divide-y divide-val-gray-dark/30">
            <div
              v-for="player in teamB"
              :key="player.puuid"
              class="p-4"
            >
              <div class="flex items-center gap-3 mb-3">
                <img
                  :src="player.assets.agent.small"
                  :alt="player.character"
                  class="w-12 h-12 rounded bg-val-darker shrink-0"
                >
                <div class="flex-1 min-w-0">
                  <p class="text-val-cream font-medium truncate" :title="player.name">
                    {{ player.name }}
                  </p>
                  <p class="text-xs text-val-gray truncate">
                    #{{ player.tag }} · {{ translateRank(player.currenttier_patched) }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-mono text-val-cream font-bold">
                    {{ getKDA(player) }}
                  </p>
                  <p class="text-xs" :class="Number(getKDRatio(player)) >= 1 ? 'text-green-400' : 'text-val-red'">
                    {{ getKDRatio(player) }} K/D
                  </p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center text-xs">
                <div class="bg-val-darker rounded p-2">
                  <p class="text-val-gray">
                    ACS
                  </p>
                  <p class="text-val-cream font-mono">
                    {{ getACS(player) }}
                  </p>
                </div>
                <div class="bg-val-darker rounded p-2">
                  <p class="text-val-gray">
                    HS%
                  </p>
                  <p class="text-val-cream font-mono">
                    {{ getHeadshotPercent(player) }}%
                  </p>
                </div>
                <div class="bg-val-darker rounded p-2">
                  <p class="text-val-gray">
                    DMG
                  </p>
                  <p class="text-val-cream font-mono">
                    {{ player.damage_made }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
