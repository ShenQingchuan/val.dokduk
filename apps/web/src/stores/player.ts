import type { MatchData, PlayerAccount, PlayerMMR, PlayerStats } from '@/api/valorant'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { valorantApi } from '@/api/valorant'

const MATCHES_PER_PAGE = 10

export const usePlayerStore = defineStore('player', () => {
  // Basic data
  const account = ref<PlayerAccount | null>(null)
  const mmr = ref<PlayerMMR | null>(null)
  const matches = ref<MatchData[]>([])
  const stats = ref<PlayerStats | null>(null) // 后端计算的统计数据

  // Loading states
  const playerLoading = ref(false)
  const matchesLoading = ref(false)
  const matchesLoadingMore = ref(false)

  // Error states
  const playerError = ref<string | null>(null)
  const matchesError = ref<string | null>(null)

  // Pagination
  const matchesHasMore = ref(true)

  // Backward compatible computed
  const loading = computed(() => playerLoading.value)
  const error = computed(() => playerError.value || matchesError.value)

  /**
   * 使用 BFF 聚合接口获取玩家概览数据
   * 一次请求获取：账号、MMR、统计数据、比赛记录
   */
  async function fetchPlayerWithMatches(name: string, tag: string, region = 'ap') {
    // Reset state
    account.value = null
    mmr.value = null
    matches.value = []
    stats.value = null
    matchesHasMore.value = true
    playerError.value = null
    matchesError.value = null
    playerLoading.value = true
    matchesLoading.value = true

    try {
      const overview = await valorantApi.getPlayerOverview(region, name, tag, MATCHES_PER_PAGE)

      account.value = overview.account
      mmr.value = overview.mmr
      stats.value = overview.stats
      matches.value = overview.matches

      // 检查是否有更多数据
      matchesHasMore.value = overview.matches.length >= MATCHES_PER_PAGE
    }
    catch (err) {
      playerError.value = err instanceof Error ? err.message : 'Failed to fetch player data'
    }
    finally {
      playerLoading.value = false
      matchesLoading.value = false
    }
  }

  /**
   * 单独获取玩家基本信息（用于其他场景）
   */
  async function fetchPlayer(name: string, tag: string, region = 'ap') {
    playerLoading.value = true
    playerError.value = null

    try {
      const [accountData, mmrData] = await Promise.all([
        valorantApi.getAccount(name, tag),
        valorantApi.getMMR(region, name, tag).catch(() => null),
      ])

      account.value = accountData
      mmr.value = mmrData
    }
    catch (err) {
      playerError.value = err instanceof Error ? err.message : 'Failed to fetch player data'
      account.value = null
      mmr.value = null
    }
    finally {
      playerLoading.value = false
    }
  }

  /**
   * 获取比赛记录（独立页面使用）
   */
  async function fetchMatches(region: string, name: string, tag: string, options?: { size?: number }) {
    matches.value = []
    matchesHasMore.value = true
    matchesError.value = null
    matchesLoading.value = true

    try {
      const matchData = await valorantApi.getMatches(region, name, tag, {
        size: options?.size ?? MATCHES_PER_PAGE,
      })
      matches.value = matchData
      matchesHasMore.value = matchData.length >= (options?.size ?? MATCHES_PER_PAGE)
    }
    catch (err) {
      matchesError.value = err instanceof Error ? err.message : 'Failed to fetch matches'
    }
    finally {
      matchesLoading.value = false
    }
  }

  /**
   * 加载更多比赛（无限滚动）
   */
  async function loadMoreMatches(region: string, name: string, tag: string) {
    if (matchesLoadingMore.value || !matchesHasMore.value)
      return

    matchesLoadingMore.value = true
    matchesError.value = null

    try {
      // 使用当前 matches 数量作为 start offset
      const start = matches.value.length
      const matchData = await valorantApi.getMatches(region, name, tag, {
        size: MATCHES_PER_PAGE,
        start,
      })

      // 合并并去重 (v4: match_id instead of matchid)
      const existingIds = new Set(matches.value.map(m => m.metadata.match_id))
      const newMatches = matchData.filter(m => !existingIds.has(m.metadata.match_id))

      // 没有新数据则停止加载
      if (newMatches.length === 0) {
        matchesHasMore.value = false
        return
      }

      // v4: started_at is ISO string
      matches.value = [...matches.value, ...newMatches]
        .sort((a, b) => new Date(b.metadata.started_at).getTime() - new Date(a.metadata.started_at).getTime())

      matchesHasMore.value = matchData.length >= MATCHES_PER_PAGE
    }
    catch (err) {
      matchesError.value = err instanceof Error ? err.message : 'Failed to load more matches'
    }
    finally {
      matchesLoadingMore.value = false
    }
  }

  function clearPlayer() {
    account.value = null
    mmr.value = null
    matches.value = []
    stats.value = null
    playerError.value = null
    matchesError.value = null
    matchesHasMore.value = true
  }

  return {
    // Data
    account,
    mmr,
    matches,
    stats,
    // Status
    loading,
    playerLoading,
    matchesLoading,
    matchesLoadingMore,
    matchesHasMore,
    // Errors
    error,
    playerError,
    matchesError,
    // Methods
    fetchPlayer,
    fetchPlayerWithMatches,
    fetchMatches,
    loadMoreMatches,
    clearPlayer,
  }
})
