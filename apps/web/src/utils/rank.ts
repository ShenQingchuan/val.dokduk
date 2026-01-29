import type { ComposerTranslation } from 'vue-i18n'

/**
 * Parse rank tier from API response (e.g., "Diamond 1" -> { tier: "Diamond", division: 1 })
 */
export function parseRankTier(rankString: string | undefined): { tier: string, division: number | null } {
  if (!rankString)
    return { tier: 'Unranked', division: null }

  // Handle "Radiant" (no division)
  if (rankString.toLowerCase() === 'radiant') {
    return { tier: 'Radiant', division: null }
  }

  // Parse "Diamond 1", "Gold 3", etc.
  const match = rankString.match(/^(\w+)\s*(\d)?$/)
  if (match) {
    return {
      tier: match[1] || 'Unranked',
      division: match[2] ? Number.parseInt(match[2], 10) : null,
    }
  }

  return { tier: rankString, division: null }
}

/**
 * Translate rank tier name
 */
export function translateRankTier(t: ComposerTranslation, tier: string): string {
  const tierLower = tier.toLowerCase()
  const rankKeys: Record<string, string> = {
    iron: 'rank_iron',
    bronze: 'rank_bronze',
    silver: 'rank_silver',
    gold: 'rank_gold',
    platinum: 'rank_platinum',
    diamond: 'rank_diamond',
    ascendant: 'rank_ascendant',
    immortal: 'rank_immortal',
    radiant: 'rank_radiant',
    unranked: 'player_unranked',
  }

  const key = rankKeys[tierLower]
  if (key) {
    return t(key)
  }

  return tier // Fallback to original
}

/**
 * Get translated full rank string (e.g., "Diamond 1" -> "钻石 1")
 */
export function getTranslatedRank(t: ComposerTranslation, rankString: string | undefined): string {
  if (!rankString)
    return t('player_unranked')

  const { tier, division } = parseRankTier(rankString)
  const translatedTier = translateRankTier(t, tier)

  if (division !== null) {
    return `${translatedTier} ${division}`
  }

  return translatedTier
}

/**
 * Competitive tier ID used in Valorant API for rank icons
 * This is the current competitive tier set UUID
 */
const COMPETITIVE_TIER_ID = '03621f52-342b-cf4e-4f86-9350a49c6d04'

/**
 * Get rank icon URL by tier number
 * @param tier - The tier number (0-27, where 18 = Diamond 1)
 * @param size - 'small' | 'large' (default: 'large')
 */
export function getRankIconUrl(tier: number | undefined, size: 'small' | 'large' = 'large'): string | null {
  if (tier === undefined || tier === null || tier === 0) {
    return null
  }
  return `https://media.valorant-api.com/competitivetiers/${COMPETITIVE_TIER_ID}/${tier}/${size}icon.png`
}

/**
 * 格式化赛季代码 (e.g., "e8a1" -> "S8 第1赛段")
 */
export function formatSeason(t: ComposerTranslation, seasonCode: string | undefined): string {
  if (!seasonCode)
    return ''

  // 解析 e8a1 格式
  const match = seasonCode.match(/^e(\d+)a(\d+)$/i)
  if (match) {
    const episode = match[1]
    const act = match[2]
    return t('season_format', { episode, act })
  }

  return seasonCode
}

/**
 * Format time ago string with i18n
 */
export function formatTimeAgo(t: ComposerTranslation, timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (days > 0)
    return t('match_time_days_ago', { n: days })
  if (hours > 0)
    return t('match_time_hours_ago', { n: hours })
  if (minutes > 0)
    return t('match_time_minutes_ago', { n: minutes })
  return t('match_time_just_now')
}
