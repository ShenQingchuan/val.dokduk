import type { MatchData, MatchPlayer, TeamData } from '@/api/valorant'

export interface PlayerStats {
  // 总场数
  totalGames: number
  // 胜场
  wins: number
  // 胜率
  winRate: number
  // 总击杀
  totalKills: number
  // 总死亡
  totalDeaths: number
  // 总助攻
  totalAssists: number
  // KD
  kd: number
  // KDA
  kda: number
  // 场均得分 ACS (Average Combat Score)
  acs: number
  // 爆头率
  headshotRate: number
  // 总爆头数
  totalHeadshots: number
  // 总躯干命中
  totalBodyshots: number
  // 总腿部命中
  totalLegshots: number
  // 总造成伤害
  totalDamageMade: number
  // 总承受伤害
  totalDamageReceived: number
  // DDΔ (伤害差)
  damageDelta: number
  // DDΔ/R (每回合伤害差)
  damageDeltaPerRound: number
  // 总回合数
  totalRounds: number
  // 平均每回合击杀
  killsPerRound: number
  // 首杀次数 (需要从 rounds 数据获取，目前 API 可能不提供)
  firstKills: number
  // KAST% (参与击杀/助攻/存活/换人头的回合百分比) - 简化版本
  kast: number
}

/**
 * 检查比赛数据是否有完整的玩家信息
 */
export function isFullMatchData(match: MatchData): boolean {
  return !!(match.players && Array.isArray(match.players) && match.players.length > 0)
}

/**
 * 在比赛中找到指定玩家
 */
export function findPlayerInMatch(match: MatchData, playerName: string, playerTag: string): MatchPlayer | null {
  if (!isFullMatchData(match)) {
    return null
  }

  const nameLower = playerName.toLowerCase()
  const tagLower = playerTag.toLowerCase()

  return match.players.find(
    (p: MatchPlayer) => p.name.toLowerCase() === nameLower && p.tag.toLowerCase() === tagLower,
  ) || null
}

/**
 * 根据 team_id 找到对应的队伍数据
 */
function findTeamData(teams: TeamData[], teamId: string): TeamData | null {
  return teams.find(t => t.team_id.toLowerCase() === teamId.toLowerCase()) || null
}

/**
 * 判断玩家是否赢得了比赛
 */
export function didPlayerWin(match: MatchData, player: MatchPlayer): boolean {
  const team = findTeamData(match.teams, player.team_id)
  return team?.won ?? false
}

/**
 * 从比赛记录计算玩家统计数据
 */
export function calculatePlayerStats(matches: MatchData[], playerName: string, playerTag: string): PlayerStats {
  const stats: PlayerStats = {
    totalGames: 0,
    wins: 0,
    winRate: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0,
    kd: 0,
    kda: 0,
    acs: 0,
    headshotRate: 0,
    totalHeadshots: 0,
    totalBodyshots: 0,
    totalLegshots: 0,
    totalDamageMade: 0,
    totalDamageReceived: 0,
    damageDelta: 0,
    damageDeltaPerRound: 0,
    totalRounds: 0,
    killsPerRound: 0,
    firstKills: 0,
    kast: 0,
  }

  let totalScore = 0

  for (const match of matches) {
    const player = findPlayerInMatch(match, playerName, playerTag)
    if (!player)
      continue

    stats.totalGames++

    // 胜负
    if (didPlayerWin(match, player)) {
      stats.wins++
    }

    // 累加数据
    stats.totalKills += player.stats.kills
    stats.totalDeaths += player.stats.deaths
    stats.totalAssists += player.stats.assists
    stats.totalHeadshots += player.stats.headshots
    stats.totalBodyshots += player.stats.bodyshots
    stats.totalLegshots += player.stats.legshots
    stats.totalDamageMade += player.stats.damage.dealt
    stats.totalDamageReceived += player.stats.damage.received
    stats.totalRounds += match.rounds?.length ?? 0
    totalScore += player.stats.score
  }

  // 计算比率
  if (stats.totalGames > 0) {
    stats.winRate = (stats.wins / stats.totalGames) * 100
  }

  // ACS = score / rounds (不是 score / games)
  if (stats.totalRounds > 0) {
    stats.acs = totalScore / stats.totalRounds
  }

  if (stats.totalDeaths > 0) {
    stats.kd = stats.totalKills / stats.totalDeaths
    stats.kda = (stats.totalKills + stats.totalAssists) / stats.totalDeaths
  }
  else if (stats.totalKills > 0) {
    stats.kd = stats.totalKills
    stats.kda = stats.totalKills + stats.totalAssists
  }

  const totalShots = stats.totalHeadshots + stats.totalBodyshots + stats.totalLegshots
  if (totalShots > 0) {
    stats.headshotRate = (stats.totalHeadshots / totalShots) * 100
  }

  stats.damageDelta = stats.totalDamageMade - stats.totalDamageReceived

  if (stats.totalRounds > 0) {
    stats.damageDeltaPerRound = stats.damageDelta / stats.totalRounds
    stats.killsPerRound = stats.totalKills / stats.totalRounds
  }

  // KAST 简化估算（基于 KDA）
  // 真实 KAST 需要回合级别数据，这里用简化公式估算
  if (stats.totalRounds > 0) {
    // 估算：(击杀+助攻+存活回合) / 总回合
    // 存活回合约等于 总回合 - 死亡次数
    const surviveRounds = Math.max(0, stats.totalRounds - stats.totalDeaths)
    const participationRounds = Math.min(stats.totalRounds, stats.totalKills + stats.totalAssists + surviveRounds)
    stats.kast = (participationRounds / stats.totalRounds) * 100
    // 限制在合理范围内
    stats.kast = Math.min(100, stats.kast)
  }

  return stats
}

/**
 * 格式化数字为固定小数位
 */
export function formatStat(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}
