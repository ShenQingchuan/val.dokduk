<script setup lang="ts">
import { useWindowVirtualizer } from '@tanstack/vue-virtual'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import MatchCardFull from '@/components/MatchCardFull.vue'
import { usePlayerOverview } from '@/queries/player'
import { formatSeason, getRankIconUrl, getTranslatedRank } from '@/utils/rank'
import { formatPercent, formatStat } from '@/utils/stats'

const { t } = useI18n()
const route = useRoute()

// Use Pinia Colada query for cached player data
const {
  setPlayer,
  account,
  mmr,
  stats,
  matches,
  isPending: playerLoading,
  error: playerError,
  isLoading: matchesLoading,
  matchesLoadingMore,
  matchesHasMore,
  matchesError,
  loadMoreMatches,
  refresh,
} = usePlayerOverview()

const translatedCurrentRank = computed(() =>
  getTranslatedRank(t, mmr.value?.current_data?.currenttierpatched),
)
const translatedPeakRank = computed(() =>
  getTranslatedRank(t, mmr.value?.highest_rank?.patched_tier),
)
const peakRankIconUrl = computed(() =>
  getRankIconUrl(mmr.value?.highest_rank?.tier),
)
const peakRankSeason = computed(() =>
  formatSeason(t, mmr.value?.highest_rank?.season),
)

const name = computed(() => route.params.name as string)
const tag = computed(() => route.params.tag as string)

// Virtual scroll container ref for measuring offset
const listContainerRef = ref<HTMLElement | null>(null)

// Window virtual scroll configuration
// MatchCardFull height: p-4(32px) + icon(56/64px) + mt-3(12px) + stats(~36px) + py-1.5(12px)
// Mobile: ~148px, Desktop(md:768px+): ~156px
const rowVirtualizer = useWindowVirtualizer(computed(() => ({
  count: matches.value.length,
  estimateSize: () => window.innerWidth >= 768 ? 156 : 148,
  overscan: 5,
  scrollMargin: listContainerRef.value?.offsetTop ?? 0,
})))

// Handle window scroll for infinite loading
function handleScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const scrollHeight = document.documentElement.scrollHeight
  const clientHeight = window.innerHeight

  // Load more when 200px from bottom
  if (scrollHeight - scrollTop - clientHeight < 200) {
    loadMoreMatches()
  }
}

// Set player when route params are available or change
onMounted(() => {
  if (name.value && tag.value) {
    setPlayer(name.value, tag.value)
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

watch([name, tag], ([newName, newTag]) => {
  if (newName && newTag) {
    setPlayer(newName, newTag)
  }
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Loading state -->
    <div v-if="playerLoading" class="flex items-center justify-center py-32">
      <div class="text-center">
        <div class="i-svg-spinners-ring-resize w-12 h-12 text-val-red mx-auto mb-4" />
        <p class="text-val-gray">
          {{ t('player_loading') }}
        </p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="playerError" class="px-4 py-32">
      <div class="text-center max-w-md mx-auto">
        <div class="w-20 h-20 mx-auto mb-6 relative">
          <svg class="w-full h-full text-val-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="text-val-red mb-6">
          {{ playerError }}
        </p>
        <button
          class="btn-val rounded-lg"
          @click="refresh()"
        >
          {{ t('common_retry') }}
        </button>
      </div>
    </div>

    <!-- Player data -->
    <div v-else-if="account" class="pb-8">
      <!-- Hero Section: Player Card Banner -->
      <div class="relative">
        <!-- Background image -->
        <div class="h-30 md:h-48 relative overflow-hidden">
          <img
            v-if="account.card?.wide"
            :src="account.card.wide"
            alt="Player Card"
            class="w-full h-full object-contain"
          >
          <div class="absolute inset-0 bg-gradient-to-t from-val-black via-val-black/60 to-transparent" />
          <div class="absolute inset-0 bg-gradient-to-r from-val-black/80 to-transparent" />
        </div>

        <!-- Player info overlay -->
        <div class="absolute bottom-0 left-0 right-0 px-4 md:px-8">
          <div class="max-w-4xl mx-auto flex items-start gap-4 md:gap-6">
            <!-- Name -->
            <div class="flex-1 min-w-0">
              <h1 class="relative text- text-2xl md:text-4xl font-bold text-val-cream truncate ml-2">
                {{ account.name }}
                <div class="flex items-center gap-2 text-val-gray font-normal">
                  #{{ account.tag }}
                  <!-- Level badge -->
                  <div class="px-1.5 py-1 bg-slate-300/50 text-white text-xs rounded">
                    Lv.{{ account.account_level }}
                  </div>
                </div>
              </h1>
            </div>
          </div>
        </div>
      </div>

      <!-- Content Section -->
      <div class="max-w-4xl mx-auto px-4 md:px-8 mt-6">
        <!-- Rank Cards (并排) -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <!-- 当前段位 -->
          <div class="card-val px-4 pt-3 pb-6">
            <h3 class="text-xs font-medium text-val-gray uppercase tracking-wider mb-3">
              {{ t('player_rank') }}
            </h3>
            <div v-if="mmr" class="flex flex-col md:flex-row items-center gap-2 md:gap-3">
              <div class="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <img
                  v-if="mmr.current_data?.images?.large"
                  :src="mmr.current_data.images.large"
                  :alt="mmr.current_data.currenttierpatched"
                  class="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,70,85,0.3)]"
                >
                <div v-else class="i-simple-icons-valorant w-8 h-8 text-val-gray-dark" />
              </div>
              <div class="text-center md:text-left">
                <p class="font-medium text-val-cream text-sm md:text-base">
                  {{ translatedCurrentRank }}
                </p>
                <p class="text-val-gray text-xs md:text-sm">
                  {{ mmr.current_data?.ranking_in_tier || 0 }} {{ t('player_rr') }}
                </p>
              </div>
            </div>
            <div v-else class="text-val-gray text-sm">
              {{ t('player_no_rank') }}
            </div>
          </div>

          <!-- 历史最高 -->
          <div class="card-val px-4 pt-3 pb-6">
            <h3 class="text-xs font-medium text-val-gray uppercase tracking-wider mb-3">
              {{ t('player_highest_rank') }}
            </h3>
            <div v-if="mmr?.highest_rank" class="flex flex-col md:flex-row items-center gap-2 md:gap-3">
              <div class="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                <img
                  v-if="peakRankIconUrl"
                  :src="peakRankIconUrl"
                  :alt="mmr.highest_rank.patched_tier"
                  class="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,70,85,0.3)]"
                >
                <div v-else class="i-simple-icons-valorant w-8 h-8 text-val-gray-dark" />
              </div>
              <div class="text-center md:text-left">
                <p class="font-medium text-val-cream text-sm md:text-base">
                  {{ translatedPeakRank }}
                </p>
                <p class="text-val-gray text-xs md:text-sm">
                  {{ peakRankSeason }}
                </p>
              </div>
            </div>
            <div v-else class="text-val-gray text-sm">
              {{ t('player_no_peak_rank') }}
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div v-if="stats && stats.totalGames > 0" class="mb-6">
          <h3 class="text-xs font-medium text-slate-200 uppercase tracking-wider mb-2 pb-2 border-b border-b-slate-100/20">
            {{ t('stats_recent') }} {{ stats.totalGames }} {{ t('stats_games') }}
          </h3>

          <div class="grid grid-cols-4 md:grid-cols-4 gap-2">
            <!-- 胜率 -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                {{ t('stats_win_rate') }}
              </p>
              <p class="font-medium text-val-cream ">
                {{ formatPercent(stats.winRate) }}
              </p>
              <p class="text-xs text-val-gray">
                {{ stats.wins }}W {{ stats.totalGames - stats.wins }}L
              </p>
            </div>

            <!-- KD -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                K/D
              </p>
              <p class="font-medium" :class="stats.kd >= 1 ? 'text-green-400' : 'text-val-red'">
                {{ formatStat(stats.kd, 2) }}
              </p>
              <p class="text-xs text-val-gray">
                {{ stats.totalKills }}/{{ stats.totalDeaths }}
              </p>
            </div>

            <!-- ACS -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                ACS
              </p>
              <p class="font-medium text-val-cream ">
                {{ formatStat(stats.acs, 1) }}
              </p>
            </div>

            <!-- 爆头率 -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                {{ t('stats_headshot_rate') }}
              </p>
              <p class="font-medium text-val-cream ">
                {{ formatPercent(stats.headshotRate) }}
              </p>
              <p class="text-xs text-val-gray">
                {{ stats.totalHeadshots }} HS
              </p>
            </div>

            <!-- KAST -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                KAST
              </p>
              <p class="font-medium text-val-cream ">
                {{ formatPercent(stats.kast) }}
              </p>
            </div>

            <!-- DDΔ/R -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                DDΔ/R
              </p>
              <p class="font-medium" :class="stats.damageDeltaPerRound >= 0 ? 'text-green-400' : 'text-val-red'">
                {{ stats.damageDeltaPerRound >= 0 ? '+' : '' }}{{ formatStat(stats.damageDeltaPerRound, 1) }}
              </p>
            </div>

            <!-- 每回合击杀 -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                {{ t('stats_kills_per_round') }}
              </p>
              <p class="font-medium text-val-cream ">
                {{ formatStat(stats.killsPerRound, 2) }}
              </p>
            </div>

            <!-- 击杀/助攻 -->
            <div class="p-1">
              <p class="text-xs text-val-gray mb-0.5">
                K/A
              </p>
              <p class="font-medium text-val-cream ">
                {{ stats.totalKills }}/{{ stats.totalAssists }}
              </p>
            </div>
          </div>
        </div>

        <!-- Stats loading -->
        <div v-else-if="matchesLoading" class="mb-6 text-center py-8">
          <div class="i-svg-spinners-ring-resize w-8 h-8 text-val-red mx-auto mb-4" />
          <p class="text-val-gray text-sm">
            {{ t('stats_loading') }}
          </p>
        </div>

        <!-- Match History Section -->
        <div ref="listContainerRef" class="mt-6">
          <h3 class="text-xs font-medium text-slate-200 uppercase tracking-wider mb-2 pb-2 border-b border-b-slate-100/20">
            {{ t('player_matches') }}
          </h3>

          <!-- Matches loading -->
          <div v-if="matchesLoading && matches.length === 0" class="flex items-center justify-center py-20">
            <div class="text-center">
              <div class="i-svg-spinners-ring-resize w-10 h-10 text-val-red mx-auto mb-4" />
              <p class="text-val-gray">
                {{ t('match_loading') }}
              </p>
            </div>
          </div>

          <!-- Matches error -->
          <div v-else-if="matchesError && matches.length === 0" class="text-center py-20">
            <p class="text-val-red mb-4">
              {{ matchesError }}
            </p>
            <button
              class="btn-val rounded-lg"
              @click="refresh()"
            >
              {{ t('common_retry') }}
            </button>
          </div>

          <!-- Empty state -->
          <div v-else-if="matches.length === 0 && !matchesLoading" class="text-center py-20">
            <svg class="w-16 h-16 text-val-gray-dark mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-val-gray">
              {{ t('match_no_matches') }}
            </p>
          </div>

          <!-- Virtual scroll match list -->
          <div
            v-else-if="matches.length > 0"
            class="relative w-full"
            :style="{ height: `${rowVirtualizer.getTotalSize()}px` }"
          >
            <div
              v-for="virtualRow in rowVirtualizer.getVirtualItems()"
              :key="Number(virtualRow.key)"
              class="absolute top-0 left-0 w-full"
              :style="{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
              }"
            >
              <div class="py-1.5">
                <MatchCardFull
                  :match="matches[virtualRow.index]!"
                  :player-name="name"
                  :player-tag="tag"
                />
              </div>
            </div>
          </div>

          <!-- Load more indicator -->
          <div v-if="matchesLoadingMore" class="flex justify-center py-6">
            <div class="i-svg-spinners-ring-resize w-8 h-8 text-val-red" />
          </div>

          <!-- No more data -->
          <div v-else-if="!matchesHasMore && matches.length > 0" class="text-center py-4">
            <p class="text-val-gray text-sm">
              {{ t('match_no_more') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
