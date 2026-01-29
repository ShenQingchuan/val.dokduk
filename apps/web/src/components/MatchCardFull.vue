<script setup lang="ts">
import type { MatchData } from '@/api/valorant'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { formatTimeAgo } from '@/utils/rank'

const props = defineProps<{
  match: MatchData
  playerName: string
  playerTag: string
}>()

const { t } = useI18n()
const router = useRouter()

function goToMatchDetail() {
  router.push(`/match/${props.match.metadata.match_id}`)
}

const player = computed(() => {
  if (!props.match.players || !Array.isArray(props.match.players)) {
    return undefined
  }
  return props.match.players.find(
    p => p.name === props.playerName && p.tag === props.playerTag,
  )
})

const playerTeam = computed(() => {
  if (!player.value)
    return undefined
  return props.match.teams.find(t => t.team_id.toLowerCase() === player.value!.team_id.toLowerCase())
})

const isWin = computed(() => {
  return playerTeam.value?.won ?? false
})

const kda = computed(() => {
  if (!player.value)
    return { text: '0/0/0', ratio: '0.00' }
  const { kills, deaths, assists } = player.value.stats
  const ratio = deaths === 0 ? kills + assists : (kills + assists) / deaths
  return {
    text: `${kills}/${deaths}/${assists}`,
    ratio: ratio.toFixed(2),
  }
})

const headshotPercent = computed(() => {
  if (!player.value)
    return 0
  const { headshots, bodyshots, legshots } = player.value.stats
  const total = headshots + bodyshots + legshots
  if (total === 0)
    return 0
  return Math.round((headshots / total) * 100)
})

// Format time ago with i18n (v4 uses started_at ISO string)
const timeAgo = computed(() => {
  const start = new Date(props.match.metadata.started_at).getTime()
  return formatTimeAgo(t, start)
})

// 翻译地图名称 (v4: map is an object with name)
const translatedMap = computed(() => {
  const mapName = props.match.metadata.map?.name?.toLowerCase()
  if (!mapName)
    return props.match.metadata.map?.name || 'Unknown'
  const mapKey = `map_${mapName}`
  const translated = t(mapKey)
  return translated === mapKey ? props.match.metadata.map.name : translated
})

// 翻译游戏模式 (v4: queue.name instead of mode)
const translatedMode = computed(() => {
  const mode = props.match.metadata.queue?.name?.toLowerCase().replace(/\s+/g, '')
  if (!mode)
    return props.match.metadata.queue?.name || 'Unknown'
  const modeKey = `mode_${mode}`
  const translated = t(modeKey)
  return translated === modeKey ? props.match.metadata.queue.name : translated
})
</script>

<template>
  <div
    class="relative overflow-hidden transition-all duration-200 hover:scale-[1.01] bg-val-dark border rounded-lg cursor-pointer" :class="[
      isWin
        ? 'border-green-500/30 hover:border-green-500/50'
        : 'border-val-red/30 hover:border-val-red/50',
    ]"
    @click="goToMatchDetail"
  >
    <!-- Left side win/lose indicator bar -->
    <div
      class="absolute left-0 top-0 bottom-0 w-1" :class="[
        isWin ? 'bg-green-500' : 'bg-val-red',
      ]"
    />

    <div class="p-4 pl-5">
      <div class="flex items-center gap-4">
        <!-- Agent Icon -->
        <div class="relative flex-shrink-0">
          <div class="w-auto h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-val-darker">
            <img
              v-if="player?.agent?.id"
              :src="`https://media.valorant-api.com/agents/${player.agent.id}/displayicon.png`"
              :alt="player?.agent?.name"
              class="w-full h-full object-contain"
            >
          </div>
        </div>

        <!-- Main Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold text-val-cream text-base md:text-lg">
                {{ player?.agent?.name || 'Unknown' }}
              </p>
              <p class="text-sm text-val-gray mt-0.5">
                {{ translatedMap }} · {{ translatedMode }}
              </p>
            </div>

            <!-- Win/Lose Badge -->
            <div
              class="px-2 py-1 text-xs md:text-sm font-bold uppercase self-end rounded" :class="[
                isWin
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-val-red/20 text-val-red',
              ]"
            >
              {{ isWin ? t('match_win') : t('match_lose') }}
            </div>
          </div>

          <!-- Stats Row -->
          <div class="flex items-center gap-4 md:gap-6 mt-3 text-sm">
            <!-- KDA -->
            <div>
              <p class="text-xs text-val-gray uppercase">
                {{ t('match_kda') }}
              </p>
              <p class="font-mono font-semibold text-val-cream">
                {{ kda.text }}
                <span class="text-val-gray text-xs">({{ kda.ratio }})</span>
              </p>
            </div>

            <!-- Score -->
            <div>
              <p class="text-xs text-val-gray uppercase">
                {{ t('match_score') }}
              </p>
              <p class="font-mono font-semibold text-val-cream">
                {{ player?.stats.score || 0 }}
              </p>
            </div>

            <!-- Round Score -->
            <div class="ml-auto">
              <p class="text-xs text-val-gray uppercase">
                {{ t('match_rounds') }}
              </p>
              <p class="font-mono font-bold">
                <span :class="isWin ? 'text-green-400' : 'text-val-red'">
                  {{ playerTeam?.rounds.won ?? 0 }}
                </span>
                <span class="text-val-gray"> - </span>
                <span :class="!isWin ? 'text-green-400' : 'text-val-red'">
                  {{ playerTeam?.rounds.lost ?? 0 }}
                </span>
              </p>
            </div>

            <!-- Headshot % (hidden on mobile) -->
            <div class="hidden md:block">
              <p class="text-xs text-val-gray uppercase">
                {{ t('match_hs_percent') }}
              </p>
              <p class="font-mono font-semibold text-val-cream">
                {{ headshotPercent }}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Time -->
      <div class="absolute top-4 right-4 text-xs text-val-gray">
        {{ timeAgo }}
      </div>
    </div>
  </div>
</template>
