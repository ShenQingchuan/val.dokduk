import type { MatchData } from '@/api/valorant'
import { defineQuery, useQueryCache } from '@pinia/colada'
import { ref } from 'vue'
import { valorantApi } from '@/api/valorant'

/**
 * Query keys for match-related data
 */
export const MATCH_QUERY_KEYS = {
  root: ['match'] as const,
  detail: (matchId: string) => [...MATCH_QUERY_KEYS.root, 'detail', matchId] as const,
}

/**
 * Reusable query for match detail data
 * Uses staleTime to cache data and avoid refetching when navigating back
 */
export const useMatchDetail = defineQuery(() => {
  const matchId = ref('')

  const query = {
    key: () => MATCH_QUERY_KEYS.detail(matchId.value),
    query: async () => {
      if (!matchId.value) {
        throw new Error('Match ID is required')
      }
      return valorantApi.getMatch(matchId.value) as Promise<MatchData>
    },
    enabled: () => Boolean(matchId.value),
    staleTime: 10 * 60 * 1000, // 10 minutes - match data rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache longer
  }

  return {
    matchId,
    setMatchId(id: string) {
      matchId.value = id
    },
    queryOptions: query,
  }
})

/**
 * Helper to invalidate match cache
 */
export function useInvalidateMatch() {
  const queryCache = useQueryCache()

  return {
    invalidateMatchDetail(matchId: string) {
      queryCache.invalidateQueries({ key: MATCH_QUERY_KEYS.detail(matchId) })
    },
    invalidateAllMatches() {
      queryCache.invalidateQueries({ key: MATCH_QUERY_KEYS.root })
    },
  }
}
