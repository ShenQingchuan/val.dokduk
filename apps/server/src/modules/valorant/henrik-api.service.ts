import type { CacheService } from '../../common/cache.service.js'
import type { ConfigService } from '../../components/config/config.service.js'
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common'
import { CacheKeys, CacheService as CacheServiceToken, CacheTTL } from '../../common/cache.service.js'
import { ConfigService as ConfigServiceToken } from '../../components/config/config.service.js'

/**
 * Henrik API response wrapper
 */
interface HenrikApiResponse<T> {
  status: number
  data: T
  errors?: Array<{ message: string, code: number, status: number }>
}

/**
 * Player account data from Henrik API
 */
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

/**
 * Player MMR data from Henrik API v2
 */
export interface PlayerMMR {
  name: string
  tag: string
  puuid: string
  current_data: {
    currenttier: number
    currenttierpatched: string
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
  by_season?: Record<string, unknown>
}

/**
 * Match data from Henrik API v4
 */
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
  premier_roster: unknown | null
}

export interface RoundData {
  winning_team: string
  end_type: string
  bomb_planted: boolean
  bomb_defused: boolean
  plant_events: unknown
  defuse_events: unknown
  player_stats: unknown[]
}

/**
 * Henrik API Service
 * Handles all communication with the Henrik Valorant API
 */
@Injectable()
export class HenrikApiService {
  private readonly baseUrl: string
  private readonly apiKey: string

  private readonly logger = new Logger(HenrikApiService.name)

  constructor(
    @Inject(ConfigServiceToken) private readonly configService: ConfigService,
    @Inject(CacheServiceToken) private readonly cacheService: CacheService,
  ) {
    const env = this.configService.getAll()
    this.baseUrl = env.HENRIK_API_BASE_URL
    this.apiKey = env.HENRIK_API_KEY
  }

  /**
   * Make a request to the Henrik API
   */
  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    this.logger.debug(`Henrik API request: ${endpoint}`)

    const response = await fetch(url, {
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json() as HenrikApiResponse<T>

    if (!response.ok || data.errors) {
      const errorMsg = data.errors?.[0]?.message || `Henrik API error: ${response.status}`
      this.logger.error(`Henrik API error: ${errorMsg}`, { endpoint, status: response.status })
      throw new HttpException(errorMsg, data.errors?.[0]?.status || response.status)
    }

    return data.data
  }

  /**
   * Get player account info by name and tag
   */
  async getAccount(name: string, tag: string): Promise<PlayerAccount> {
    const cacheKey = CacheKeys.playerAccount(name, tag)

    // Check cache first
    const cached = await this.cacheService.get<PlayerAccount>(cacheKey)
    if (cached) {
      this.logger.debug(`Cache hit for account: ${name}#${tag}`)
      return cached
    }

    // Fetch from API
    const data = await this.request<PlayerAccount>(
      `/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    )

    // Cache the result
    await this.cacheService.set(cacheKey, data, CacheTTL.PLAYER_ACCOUNT)

    return data
  }

  /**
   * Get player MMR/rank data
   */
  async getMMR(region: string, name: string, tag: string): Promise<PlayerMMR> {
    const cacheKey = CacheKeys.playerMmr(region, name, tag)

    const cached = await this.cacheService.get<PlayerMMR>(cacheKey)
    if (cached) {
      this.logger.debug(`Cache hit for MMR: ${region}/${name}#${tag}`)
      return cached
    }

    const data = await this.request<PlayerMMR>(
      `/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    )

    await this.cacheService.set(cacheKey, data, CacheTTL.PLAYER_MMR)

    return data
  }

  /**
   * Get player match history (v4 API with start offset support)
   */
  async getMatches(
    region: string,
    name: string,
    tag: string,
    options?: { mode?: string, size?: number, start?: number },
  ): Promise<MatchData[]> {
    const cacheKey = CacheKeys.playerMatches(region, name, tag)

    // Only cache if no special options (default query)
    if (!options?.mode && !options?.size && !options?.start) {
      const cached = await this.cacheService.get<MatchData[]>(cacheKey)
      if (cached) {
        this.logger.debug(`Cache hit for matches: ${region}/${name}#${tag}`)
        return cached
      }
    }

    const params = new URLSearchParams()
    if (options?.mode)
      params.set('mode', options.mode)
    if (options?.size)
      params.set('size', String(options.size))
    if (options?.start)
      params.set('start', String(options.start))
    const query = params.toString() ? `?${params}` : ''

    const data = await this.request<MatchData[]>(
      `/valorant/v4/matches/${region}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}${query}`,
    )

    // Cache default query results
    if (!options?.mode && !options?.size && !options?.start) {
      await this.cacheService.set(cacheKey, data, CacheTTL.PLAYER_MATCHES)
    }

    return data
  }

  /**
   * Get match details by match ID
   */
  async getMatch(matchId: string): Promise<MatchData> {
    const cacheKey = CacheKeys.match(matchId)

    const cached = await this.cacheService.get<MatchData>(cacheKey)
    if (cached) {
      this.logger.debug(`Cache hit for match: ${matchId}`)
      return cached
    }

    const data = await this.request<MatchData>(
      `/valorant/v2/match/${matchId}`,
    )

    // Match data never changes, cache for 24 hours
    await this.cacheService.set(cacheKey, data, CacheTTL.MATCH_DETAIL)

    return data
  }
}
