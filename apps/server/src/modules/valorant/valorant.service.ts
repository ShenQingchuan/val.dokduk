import type { HenrikApiService, MatchData, MatchPlayer, PlayerAccount, PlayerMMR } from './henrik-api.service.js'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { HenrikApiService as HenrikApiServiceToken } from './henrik-api.service.js'

/**
 * 玩家统计数据
 */
export interface PlayerStats {
  totalGames: number
  wins: number
  winRate: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  kd: number
  kda: number
  acs: number
  headshotRate: number
  totalHeadshots: number
  totalBodyshots: number
  totalLegshots: number
  totalDamageMade: number
  totalDamageReceived: number
  damageDelta: number
  damageDeltaPerRound: number
  totalRounds: number
  killsPerRound: number
  kast: number
}

/**
 * 玩家概览数据（聚合响应）
 */
export interface PlayerOverview {
  account: PlayerAccount
  mmr: PlayerMMR | null
  stats: PlayerStats | null
  matches: MatchData[]
}

/**
 * Valorant 业务逻辑服务
 * 作为 BFF 层处理数据聚合和统计计算
 */
@Injectable()
export class ValorantService {
  private readonly logger = new Logger(ValorantService.name)

  constructor(
    @Inject(HenrikApiServiceToken) private readonly henrikApi: HenrikApiService,
  ) {}

  /**
   * 检查比赛数据是否有完整格式 (v4 API)
   */
  private isValidMatchData(match: MatchData): boolean {
    return !!(
      match.metadata?.match_id
      && match.players
      && Array.isArray(match.players)
      && match.teams
    )
  }

  /**
   * 在比赛中找到指定玩家 (v4 API)
   */
  private findPlayerInMatch(match: MatchData, playerName: string, playerTag: string): MatchPlayer | null {
    if (!this.isValidMatchData(match)) {
      return null
    }

    const nameLower = playerName.toLowerCase()
    const tagLower = playerTag.toLowerCase()

    return match.players.find(
      p => p.name.toLowerCase() === nameLower && p.tag.toLowerCase() === tagLower,
    ) || null
  }

  /**
   * 判断玩家是否赢得了比赛 (v4 API)
   */
  private didPlayerWin(match: MatchData, player: MatchPlayer): boolean {
    const teamId = player.team_id.toLowerCase()
    const team = match.teams.find(t => t.team_id.toLowerCase() === teamId)
    return team?.won ?? false
  }

  /**
   * 计算玩家统计数据
   */
  calculatePlayerStats(matches: MatchData[], playerName: string, playerTag: string): PlayerStats {
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
      kast: 0,
    }

    let totalScore = 0

    for (const match of matches) {
      const player = this.findPlayerInMatch(match, playerName, playerTag)
      if (!player)
        continue

      stats.totalGames++

      // 胜负
      if (this.didPlayerWin(match, player)) {
        stats.wins++
      }

      // 累加数据 (v4 API 格式)
      stats.totalKills += player.stats.kills
      stats.totalDeaths += player.stats.deaths
      stats.totalAssists += player.stats.assists
      stats.totalHeadshots += player.stats.headshots
      stats.totalBodyshots += player.stats.bodyshots
      stats.totalLegshots += player.stats.legshots
      stats.totalDamageMade += player.stats.damage.dealt
      stats.totalDamageReceived += player.stats.damage.received
      stats.totalRounds += match.rounds.length
      totalScore += player.stats.score
    }

    // 计算比率
    if (stats.totalGames > 0) {
      stats.winRate = (stats.wins / stats.totalGames) * 100
    }

    // ACS = score / rounds
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

    // KAST 简化估算
    if (stats.totalRounds > 0) {
      const surviveRounds = Math.max(0, stats.totalRounds - stats.totalDeaths)
      const participationRounds = Math.min(stats.totalRounds, stats.totalKills + stats.totalAssists + surviveRounds)
      stats.kast = (participationRounds / stats.totalRounds) * 100
      stats.kast = Math.min(100, stats.kast)
    }

    return stats
  }

  /**
   * 获取玩家概览数据（聚合接口）
   * 1. 并发获取账号、MMR、比赛记录
   * 2. 计算统计数据
   */
  async getPlayerOverview(
    name: string,
    tag: string,
    region = 'ap',
    matchSize = 10,
  ): Promise<PlayerOverview> {
    this.logger.debug(`Fetching player overview: ${name}#${tag}`)

    // 并发获取所有基础数据（统一使用 v4 API）
    const [account, mmr, matches] = await Promise.all([
      this.henrikApi.getAccount(name, tag),
      this.henrikApi.getMMR(region, name, tag).catch(() => null),
      this.henrikApi.getMatches(region, name, tag, { size: matchSize }).catch(() => [] as MatchData[]),
    ])

    // 过滤有效数据并按时间排序 (v4 API)
    const validMatches = matches
      .filter(m => this.isValidMatchData(m))
      .sort((a, b) => new Date(b.metadata.started_at).getTime() - new Date(a.metadata.started_at).getTime())

    // 计算统计数据
    const stats = validMatches.length > 0
      ? this.calculatePlayerStats(validMatches, name, tag)
      : null

    return {
      account,
      mmr,
      stats,
      matches: validMatches,
    }
  }
}
