import { apiClient } from './client'

export interface PlayerAccount {
  puuid: string
  region: string
  account_level: number
  name: string
  tag: string
  card: {
    small: string
    large: string
    wide: string
    id: string
  }
  last_update: string
  last_update_raw: number
}

export interface PlayerMMR {
  name: string
  tag: string
  puuid: string
  current_data: {
    currenttier: number
    currenttierpatched: string
    images: {
      small: string
      large: string
      triangle_down: string
      triangle_up: string
    }
    ranking_in_tier: number
    mmr_change_to_last_game: number
    elo: number
    games_needed_for_rating: number
    old: boolean
  }
  highest_rank: {
    old: boolean
    tier: number
    patched_tier: string
    season: string
  }
}

export interface MatchPlayer {
  puuid: string
  name: string
  tag: string
  team_id: string
  platform: string
  party_id: string
  agent: {
    id: string
    name: string
  }
  stats: {
    score: number
    kills: number
    deaths: number
    assists: number
    headshots: number
    bodyshots: number
    legshots: number
    damage: {
      dealt: number
      received: number
    }
  }
  ability_casts: {
    grenade: number
    ability1: number
    ability2: number
    ultimate: number
  }
  tier: {
    id: number
    name: string
  }
  customization: {
    card: string
    title: string
    preferred_level_border: string | null
  }
  account_level: number
  session_playtime_in_ms: number
  behavior: {
    afk_rounds: number
    friendly_fire: {
      incoming: number
      outgoing: number
    }
    rounds_in_spawn: number
  }
  economy: {
    spent: {
      overall: number
      average: number
    }
    loadout_value: {
      overall: number
      average: number
    }
  }
}

export interface TeamData {
  team_id: string
  rounds: {
    won: number
    lost: number
  }
  won: boolean
}

export interface KillEvent {
  kill_time_in_round: number
  kill_time_in_match: number
  killer: {
    puuid: string
    name: string
    tag: string
    team_id: string
  }
  victim: {
    puuid: string
    name: string
    tag: string
    team_id: string
  }
  assistants: Array<{
    puuid: string
    name: string
    tag: string
    team_id: string
  }>
  weapon: {
    id: string
    name: string
    type: string
  } | null
  secondary_fire_mode: boolean
}

export interface RoundPlayerStat {
  player: {
    puuid: string
    name: string
    tag: string
    team_id: string
  }
  ability_casts: {
    grenade: number
    ability1: number
    ability2: number
    ultimate: number
  }
  damage: number
  kills: number
  score: number
  economy: {
    loadout_value: number
    remaining: number
    weapon: {
      id: string
      name: string
      type: string
    } | null
    armor: {
      id: string
      name: string
    } | null
  }
  was_afk: boolean
  stayed_in_spawn: boolean
}

export interface RoundData {
  round_num: number
  winning_team: string
  end_type: string
  bomb_planted: boolean
  bomb_defused: boolean
  plant_events: {
    round_time_in_ms: number
    site: string
    player: {
      puuid: string
      name: string
      tag: string
      team_id: string
    }
  } | null
  defuse_events: {
    round_time_in_ms: number
    player: {
      puuid: string
      name: string
      tag: string
      team_id: string
    }
  } | null
  player_stats: RoundPlayerStat[]
}

export interface MatchData {
  metadata: {
    match_id: string
    map: {
      id: string
      name: string
    }
    game_version: string
    game_length_in_ms: number
    started_at: string
    is_completed: boolean
    queue: {
      id: string
      name: string
      mode_type: string
    }
    season: {
      id: string
      short: string
    }
    platform: string
    region: string
    cluster: string
  }
  players: MatchPlayer[]
  teams: TeamData[]
  rounds: RoundData[]
  kills?: KillEvent[]
}

export interface GetMatchesOptions {
  mode?: string
  size?: number
  start?: number
}

/**
 * 玩家统计数据（后端计算）
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
 * 玩家概览数据（BFF 聚合响应）
 */
export interface PlayerOverview {
  account: PlayerAccount
  mmr: PlayerMMR | null
  stats: PlayerStats | null
  matches: MatchData[]
}

export const valorantApi = {
  getAccount(name: string, tag: string): Promise<PlayerAccount> {
    return apiClient.get(`/api/valorant/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)
  },

  getMMR(region: string, name: string, tag: string): Promise<PlayerMMR> {
    return apiClient.get(`/api/valorant/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`)
  },

  getMatches(region: string, name: string, tag: string, options?: GetMatchesOptions): Promise<MatchData[]> {
    const params = new URLSearchParams()
    if (options?.mode)
      params.set('mode', options.mode)
    if (options?.size)
      params.set('size', String(options.size))
    if (options?.start)
      params.set('start', String(options.start))
    const query = params.toString() ? `?${params}` : ''
    return apiClient.get(`/api/valorant/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}${query}`)
  },

  getMatch(matchId: string): Promise<MatchData> {
    return apiClient.get(`/api/valorant/match/${matchId}`)
  },

  /**
   * BFF 聚合接口：获取玩家概览数据
   * 包含账号、MMR、统计数据、比赛记录（后端已聚合计算）
   */
  getPlayerOverview(region: string, name: string, tag: string, size?: number): Promise<PlayerOverview> {
    const params = new URLSearchParams()
    if (size)
      params.set('size', String(size))
    const query = params.toString() ? `?${params}` : ''
    return apiClient.get(`/api/valorant/player/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}${query}`)
  },
}
