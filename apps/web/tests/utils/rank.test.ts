import type { ComposerTranslation } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import {
  formatSeason,
  formatTimeAgo,
  getRankIconUrl,
  getTranslatedRank,
  parseRankTier,
  translateRankTier,
} from '../../src/utils/rank'

describe('parseRankTier', () => {
  it('should return Unranked for undefined input', () => {
    expect(parseRankTier(undefined)).toEqual({ tier: 'Unranked', division: null })
  })

  it('should return Unranked for empty string', () => {
    expect(parseRankTier('')).toEqual({ tier: 'Unranked', division: null })
  })

  it('should parse "Radiant" (no division)', () => {
    expect(parseRankTier('Radiant')).toEqual({ tier: 'Radiant', division: null })
  })

  it('should parse lowercase "radiant"', () => {
    expect(parseRankTier('radiant')).toEqual({ tier: 'Radiant', division: null })
  })

  it('should parse "Diamond 1" correctly', () => {
    expect(parseRankTier('Diamond 1')).toEqual({ tier: 'Diamond', division: 1 })
  })

  it('should parse "Gold 3" correctly', () => {
    expect(parseRankTier('Gold 3')).toEqual({ tier: 'Gold', division: 3 })
  })

  it('should parse "Iron 1" correctly', () => {
    expect(parseRankTier('Iron 1')).toEqual({ tier: 'Iron', division: 1 })
  })

  it('should parse rank without space "Diamond1" as single word (no division)', () => {
    // Current implementation requires space between tier and division
    expect(parseRankTier('Diamond1')).toEqual({ tier: 'Diamond1', division: null })
  })

  it('should parse "Immortal 3" correctly', () => {
    expect(parseRankTier('Immortal 3')).toEqual({ tier: 'Immortal', division: 3 })
  })

  it('should handle unknown rank string by returning it as tier', () => {
    expect(parseRankTier('UnknownRank')).toEqual({ tier: 'UnknownRank', division: null })
  })

  it('should handle rank with only tier name (no division)', () => {
    expect(parseRankTier('Diamond')).toEqual({ tier: 'Diamond', division: null })
  })
})

describe('translateRankTier', () => {
  const mockT = vi.fn((key: string) => `translated_${key}`) as unknown as ComposerTranslation

  it('should translate iron tier', () => {
    expect(translateRankTier(mockT, 'Iron')).toBe('translated_rank_iron')
  })

  it('should translate bronze tier', () => {
    expect(translateRankTier(mockT, 'Bronze')).toBe('translated_rank_bronze')
  })

  it('should translate silver tier', () => {
    expect(translateRankTier(mockT, 'Silver')).toBe('translated_rank_silver')
  })

  it('should translate gold tier', () => {
    expect(translateRankTier(mockT, 'Gold')).toBe('translated_rank_gold')
  })

  it('should translate platinum tier', () => {
    expect(translateRankTier(mockT, 'Platinum')).toBe('translated_rank_platinum')
  })

  it('should translate diamond tier', () => {
    expect(translateRankTier(mockT, 'Diamond')).toBe('translated_rank_diamond')
  })

  it('should translate ascendant tier', () => {
    expect(translateRankTier(mockT, 'Ascendant')).toBe('translated_rank_ascendant')
  })

  it('should translate immortal tier', () => {
    expect(translateRankTier(mockT, 'Immortal')).toBe('translated_rank_immortal')
  })

  it('should translate radiant tier', () => {
    expect(translateRankTier(mockT, 'Radiant')).toBe('translated_rank_radiant')
  })

  it('should translate unranked tier', () => {
    expect(translateRankTier(mockT, 'Unranked')).toBe('translated_player_unranked')
  })

  it('should be case insensitive', () => {
    expect(translateRankTier(mockT, 'DIAMOND')).toBe('translated_rank_diamond')
    expect(translateRankTier(mockT, 'gold')).toBe('translated_rank_gold')
  })

  it('should fallback to original tier for unknown tier', () => {
    expect(translateRankTier(mockT, 'CustomTier')).toBe('CustomTier')
  })
})

describe('getTranslatedRank', () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      player_unranked: 'Unranked',
      rank_diamond: 'Diamond',
      rank_radiant: 'Radiant',
      rank_gold: 'Gold',
    }
    return translations[key] || key
  }) as unknown as ComposerTranslation

  it('should return translated unranked for undefined input', () => {
    expect(getTranslatedRank(mockT, undefined)).toBe('Unranked')
  })

  it('should return translated rank with division', () => {
    expect(getTranslatedRank(mockT, 'Diamond 1')).toBe('Diamond 1')
  })

  it('should return translated radiant without division', () => {
    expect(getTranslatedRank(mockT, 'Radiant')).toBe('Radiant')
  })

  it('should handle Gold 3 correctly', () => {
    expect(getTranslatedRank(mockT, 'Gold 3')).toBe('Gold 3')
  })
})

describe('getRankIconUrl', () => {
  const COMPETITIVE_TIER_ID = '03621f52-342b-cf4e-4f86-9350a49c6d04'

  it('should return null for undefined tier', () => {
    expect(getRankIconUrl(undefined)).toBeNull()
  })

  it('should return null for null tier', () => {
    expect(getRankIconUrl(null as unknown as number)).toBeNull()
  })

  it('should return null for tier 0 (Unranked)', () => {
    expect(getRankIconUrl(0)).toBeNull()
  })

  it('should return large icon URL by default', () => {
    expect(getRankIconUrl(18)).toBe(
      `https://media.valorant-api.com/competitivetiers/${COMPETITIVE_TIER_ID}/18/largeicon.png`,
    )
  })

  it('should return small icon URL when specified', () => {
    expect(getRankIconUrl(18, 'small')).toBe(
      `https://media.valorant-api.com/competitivetiers/${COMPETITIVE_TIER_ID}/18/smallicon.png`,
    )
  })

  it('should return large icon URL when explicitly specified', () => {
    expect(getRankIconUrl(21, 'large')).toBe(
      `https://media.valorant-api.com/competitivetiers/${COMPETITIVE_TIER_ID}/21/largeicon.png`,
    )
  })

  it('should work for all tier numbers', () => {
    for (let tier = 1; tier <= 27; tier++) {
      expect(getRankIconUrl(tier)).toContain(`/${tier}/largeicon.png`)
    }
  })
})

describe('formatSeason', () => {
  const mockT = vi.fn((key: string, params: { episode: string, act: string }) => {
    if (key === 'season_format') {
      return `Episode ${params.episode} Act ${params.act}`
    }
    return key
  }) as unknown as ComposerTranslation

  it('should return empty string for undefined input', () => {
    expect(formatSeason(mockT, undefined)).toBe('')
  })

  it('should return empty string for empty string input', () => {
    expect(formatSeason(mockT, '')).toBe('')
  })

  it('should format e8a1 correctly', () => {
    expect(formatSeason(mockT, 'e8a1')).toBe('Episode 8 Act 1')
  })

  it('should format e1a3 correctly', () => {
    expect(formatSeason(mockT, 'e1a3')).toBe('Episode 1 Act 3')
  })

  it('should format E8A1 (uppercase) correctly', () => {
    expect(formatSeason(mockT, 'E8A1')).toBe('Episode 8 Act 1')
  })

  it('should format e10a2 correctly (double digit episode)', () => {
    expect(formatSeason(mockT, 'e10a2')).toBe('Episode 10 Act 2')
  })

  it('should return original string for invalid format', () => {
    expect(formatSeason(mockT, 'invalid')).toBe('invalid')
  })

  it('should return original string for partial format', () => {
    expect(formatSeason(mockT, 'e8')).toBe('e8')
  })

  it('should return original string for wrong pattern', () => {
    expect(formatSeason(mockT, 's8a1')).toBe('s8a1')
  })
})

describe('formatTimeAgo', () => {
  const mockT = vi.fn((key: string, params?: { n: number }) => {
    const templates: Record<string, string> = {
      match_time_just_now: 'just now',
      match_time_minutes_ago: `${params?.n} minutes ago`,
      match_time_hours_ago: `${params?.n} hours ago`,
      match_time_days_ago: `${params?.n} days ago`,
    }
    return templates[key] || key
  }) as unknown as ComposerTranslation

  it('should return "just now" for timestamps less than a minute ago', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 30000)).toBe('just now') // 30 seconds ago
  })

  it('should return minutes ago for timestamps less than an hour ago', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 5 * 60000)).toBe('5 minutes ago')
  })

  it('should return hours ago for timestamps less than a day ago', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 3 * 3600000)).toBe('3 hours ago')
  })

  it('should return days ago for timestamps more than a day ago', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 2 * 86400000)).toBe('2 days ago')
  })

  it('should handle edge case at exactly 1 minute', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 60000)).toBe('1 minutes ago')
  })

  it('should handle edge case at exactly 1 hour', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 3600000)).toBe('1 hours ago')
  })

  it('should handle edge case at exactly 1 day', () => {
    const now = Date.now()
    expect(formatTimeAgo(mockT, now - 86400000)).toBe('1 days ago')
  })
})
