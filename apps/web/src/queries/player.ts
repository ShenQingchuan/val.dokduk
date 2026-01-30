import type { MatchData } from '@/api/valorant'
import { defineQuery, useQuery, useQueryCache } from '@pinia/colada'
import { computed, ref } from 'vue'
import { valorantApi } from '@/api/valorant'

const MATCHES_PER_PAGE = 10

/**
 * Query keys for player-related data
 */
export const PLAYER_QUERY_KEYS = {
  root: ['player'] as const,
  overview: (name: string, tag: string) => [...PLAYER_QUERY_KEYS.root, 'overview', name, tag] as const,
  matches: (name: string, tag: string) => [...PLAYER_QUERY_KEYS.root, 'matches', name, tag] as const,
}

/**
 * Reusable query for player overview data (account + mmr + stats + matches)
 * Uses staleTime to cache data and avoid refetching when navigating back
 */
export const usePlayerOverview = defineQuery(() => {
  const name = ref('')
  const tag = ref('')
  const region = ref('ap')

  const { data, status, error, isPending, isLoading, refresh, refetch } = useQuery({
    key: () => PLAYER_QUERY_KEYS.overview(name.value, tag.value),
    query: async () => {
      if (!name.value || !tag.value) {
        throw new Error('Player name and tag are required')
      }
      return valorantApi.getPlayerOverview(region.value, name.value, tag.value, MATCHES_PER_PAGE)
    },
    enabled: () => Boolean(name.value && tag.value),
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache
  })

  // Derived data from overview
  const account = computed(() => data.value?.account ?? null)
  const mmr = computed(() => data.value?.mmr ?? null)
  const stats = computed(() => data.value?.stats ?? null)
  const initialMatches = computed(() => data.value?.matches ?? [])

  // Additional matches loaded via loadMore
  const additionalMatches = ref<MatchData[]>([])

  // Combined matches (initial + additional)
  const matches = computed(() => {
    const all = [...initialMatches.value, ...additionalMatches.value]
    // Deduplicate and sort by time
    const seen = new Set<string>()
    return all
      .filter((m) => {
        if (seen.has(m.metadata.match_id))
          return false
        seen.add(m.metadata.match_id)
        return true
      })
      .sort((a, b) => new Date(b.metadata.started_at).getTime() - new Date(a.metadata.started_at).getTime())
  })

  // Pagination state
  const matchesHasMore = ref(true)
  const matchesLoadingMore = ref(false)
  const matchesError = ref<string | null>(null)

  /**
   * Set player to query
   */
  function setPlayer(playerName: string, playerTag: string, playerRegion = 'ap') {
    // Reset additional matches when player changes
    if (name.value !== playerName || tag.value !== playerTag) {
      additionalMatches.value = []
      matchesHasMore.value = true
      matchesError.value = null
    }
    name.value = playerName
    tag.value = playerTag
    region.value = playerRegion
  }

  /**
   * Load more matches for infinite scroll
   */
  async function loadMoreMatches() {
    if (matchesLoadingMore.value || !matchesHasMore.value || !name.value || !tag.value)
      return

    matchesLoadingMore.value = true
    matchesError.value = null

    try {
      const start = matches.value.length
      const matchData = await valorantApi.getMatches(region.value, name.value, tag.value, {
        size: MATCHES_PER_PAGE,
        start,
      })

      // Filter out already existing matches
      const existingIds = new Set(matches.value.map(m => m.metadata.match_id))
      const newMatches = matchData.filter(m => !existingIds.has(m.metadata.match_id))

      if (newMatches.length === 0) {
        matchesHasMore.value = false
        return
      }

      additionalMatches.value = [...additionalMatches.value, ...newMatches]
      matchesHasMore.value = matchData.length >= MATCHES_PER_PAGE
    }
    catch (err) {
      matchesError.value = err instanceof Error ? err.message : 'Failed to load more matches'
    }
    finally {
      matchesLoadingMore.value = false
    }
  }

  return {
    // Query params
    name,
    tag,
    region,
    setPlayer,

    // Query state
    data,
    status,
    error,
    isPending,
    isLoading,
    refresh,
    refetch,

    // Derived data
    account,
    mmr,
    stats,
    matches,

    // Pagination
    matchesHasMore,
    matchesLoadingMore,
    matchesError,
    loadMoreMatches,
  }
})

/**
 * Helper to invalidate player cache
 */
export function useInvalidatePlayer() {
  const queryCache = useQueryCache()

  return {
    invalidatePlayerOverview(name: string, tag: string) {
      queryCache.invalidateQueries({ key: PLAYER_QUERY_KEYS.overview(name, tag) })
    },
    invalidateAllPlayers() {
      queryCache.invalidateQueries({ key: PLAYER_QUERY_KEYS.root })
    },
  }
}
