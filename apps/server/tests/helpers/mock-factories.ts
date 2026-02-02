import type { MatchData, MatchPlayer, TeamData } from '../../src/modules/valorant/henrik-api.service.js'
import { vi } from 'vitest'

/**
 * Create a mock Redis client for testing
 */
export function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    keys: vi.fn(),
    hset: vi.fn(),
    hget: vi.fn(),
    hgetall: vi.fn().mockResolvedValue({}),
    hdel: vi.fn(),
    hlen: vi.fn(),
    hexists: vi.fn(),
    sadd: vi.fn(),
    srem: vi.fn(),
    smembers: vi.fn().mockResolvedValue([]),
    lpush: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    ltrim: vi.fn(),
    rpush: vi.fn(),
  }
}

/**
 * Create a mock database client for testing
 */
export function createMockDb() {
  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
  return mockBuilder
}

/**
 * Create a mock player for testing
 */
export function createMockPlayer(overrides: Partial<{
  name: string
  tag: string
  team_id: string
  kills: number
  deaths: number
  assists: number
  headshots: number
  bodyshots: number
  legshots: number
  score: number
  damage_dealt: number
  damage_received: number
}> = {}): MatchPlayer {
  return {
    puuid: 'test-puuid',
    name: overrides.name ?? 'TestPlayer',
    tag: overrides.tag ?? 'TAG',
    team_id: overrides.team_id ?? 'Blue',
    agent: { name: 'Jett', id: 'jett-uuid' },
    stats: {
      kills: overrides.kills ?? 10,
      deaths: overrides.deaths ?? 5,
      assists: overrides.assists ?? 3,
      headshots: overrides.headshots ?? 20,
      bodyshots: overrides.bodyshots ?? 50,
      legshots: overrides.legshots ?? 10,
      score: overrides.score ?? 2500,
      damage: {
        dealt: overrides.damage_dealt ?? 3000,
        received: overrides.damage_received ?? 2000,
      },
    },
    tier: { name: 'Diamond 1', id: 18 },
  } as MatchPlayer
}

/**
 * Create a mock team for testing
 */
export function createMockTeam(overrides: Partial<{
  team_id: string
  won: boolean
  rounds_won: number
  rounds_lost: number
}> = {}): TeamData {
  return {
    team_id: overrides.team_id ?? 'Blue',
    won: overrides.won ?? true,
    rounds_won: overrides.rounds_won ?? 13,
    rounds_lost: overrides.rounds_lost ?? 7,
  } as TeamData
}

/**
 * Create a mock match for testing
 */
export function createMockMatch(overrides: Partial<{
  match_id: string
  players: MatchPlayer[]
  teams: TeamData[]
  rounds: unknown[]
  started_at: string
  map: string
  mode: string
}> = {}): MatchData {
  const defaultPlayers = [createMockPlayer()]
  const defaultTeams = [
    createMockTeam({ team_id: 'Blue', won: true }),
    createMockTeam({ team_id: 'Red', won: false }),
  ]

  return {
    metadata: {
      match_id: overrides.match_id ?? 'test-match-id',
      map: { name: overrides.map ?? 'Ascent', id: 'ascent-uuid' },
      started_at: overrides.started_at ?? '2024-01-01T00:00:00Z',
      game_mode: overrides.mode ?? 'Competitive',
      queue: { name: 'Competitive', id: 'comp-queue' },
      region: 'ap',
      cluster: 'ap',
      season_id: 'test-season',
    },
    players: overrides.players ?? defaultPlayers,
    teams: overrides.teams ?? defaultTeams,
    rounds: overrides.rounds ?? Array.from({ length: 20 }, () => ({})),
  } as MatchData
}

/**
 * Create mock HenrikApiService
 */
export function createMockHenrikApiService() {
  return {
    getAccount: vi.fn(),
    getMMR: vi.fn(),
    getMatches: vi.fn(),
    getMatch: vi.fn(),
  }
}

/**
 * Create mock ConfigService
 */
export function createMockConfigService(overrides: Record<string, string> = {}) {
  return {
    getAll: vi.fn().mockReturnValue({
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      HENRIK_API_BASE_URL: 'https://api.henrikdev.xyz',
      HENRIK_API_KEY: 'test-api-key',
      TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
      ...overrides,
    }),
  }
}

/**
 * Create mock TurnstileService
 */
export function createMockTurnstileService() {
  return {
    verify: vi.fn().mockResolvedValue(true),
  }
}

/**
 * Create mock JwtService
 */
export function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn(),
  }
}
