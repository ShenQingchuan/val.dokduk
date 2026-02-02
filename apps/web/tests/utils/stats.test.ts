import type { MatchData, MatchPlayer } from '@/api/valorant'
import { describe, expect, it } from 'vitest'
import {
  calculatePlayerStats,
  didPlayerWin,
  findPlayerInMatch,
  formatPercent,
  formatStat,
  isFullMatchData,
} from '../../src/utils/stats'

// Helper function to create mock match data
function createMockMatch(overrides: Partial<{
  players: MatchPlayer[]
  teams: { team_id: string, won: boolean }[]
  rounds: unknown[]
}>): MatchData {
  return {
    metadata: {
      match_id: 'test-match-id',
      map: { name: 'Ascent' },
      started_at: '2024-01-01T00:00:00Z',
      game_mode: 'Competitive',
      queue: { name: 'Competitive' },
      region: 'ap',
      cluster: 'ap',
      season_id: 'test-season',
    },
    players: overrides.players ?? [],
    teams: overrides.teams ?? [],
    rounds: overrides.rounds ?? [],
  } as MatchData
}

// Helper function to create mock player
function createMockPlayer(overrides: Partial<{
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
}>): MatchPlayer {
  return {
    puuid: 'test-puuid',
    name: overrides.name ?? 'TestPlayer',
    tag: overrides.tag ?? 'TAG',
    team_id: overrides.team_id ?? 'Blue',
    agent: { name: 'Jett' },
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
    tier: { name: 'Diamond 1' },
  } as MatchPlayer
}

describe('isFullMatchData', () => {
  it('should return true when match has players array with items', () => {
    const match = createMockMatch({
      players: [createMockPlayer({})],
    })
    expect(isFullMatchData(match)).toBe(true)
  })

  it('should return false when match has empty players array', () => {
    const match = createMockMatch({ players: [] })
    expect(isFullMatchData(match)).toBe(false)
  })

  it('should return false when match has no players property', () => {
    const match = { metadata: {} } as MatchData
    expect(isFullMatchData(match)).toBe(false)
  })

  it('should return false when players is not an array', () => {
    const match = { players: 'invalid' } as unknown as MatchData
    expect(isFullMatchData(match)).toBe(false)
  })
})

describe('findPlayerInMatch', () => {
  it('should find player by name and tag (case insensitive)', () => {
    const player = createMockPlayer({ name: 'TestPlayer', tag: 'TAG' })
    const match = createMockMatch({ players: [player] })

    const found = findPlayerInMatch(match, 'testplayer', 'tag')
    expect(found).toEqual(player)
  })

  it('should find player with exact case', () => {
    const player = createMockPlayer({ name: 'TestPlayer', tag: 'TAG' })
    const match = createMockMatch({ players: [player] })

    const found = findPlayerInMatch(match, 'TestPlayer', 'TAG')
    expect(found).toEqual(player)
  })

  it('should return null when player not found', () => {
    const player = createMockPlayer({ name: 'TestPlayer', tag: 'TAG' })
    const match = createMockMatch({ players: [player] })

    const found = findPlayerInMatch(match, 'OtherPlayer', 'OTHER')
    expect(found).toBeNull()
  })

  it('should return null when match has no players', () => {
    const match = createMockMatch({ players: [] })

    const found = findPlayerInMatch(match, 'TestPlayer', 'TAG')
    expect(found).toBeNull()
  })

  it('should find correct player among multiple players', () => {
    const player1 = createMockPlayer({ name: 'Player1', tag: 'ONE' })
    const player2 = createMockPlayer({ name: 'Player2', tag: 'TWO' })
    const player3 = createMockPlayer({ name: 'Player3', tag: 'THREE' })
    const match = createMockMatch({ players: [player1, player2, player3] })

    const found = findPlayerInMatch(match, 'Player2', 'TWO')
    expect(found).toEqual(player2)
  })
})

describe('didPlayerWin', () => {
  it('should return true when player team won', () => {
    const player = createMockPlayer({ team_id: 'Blue' })
    const match = createMockMatch({
      players: [player],
      teams: [
        { team_id: 'Blue', won: true },
        { team_id: 'Red', won: false },
      ],
    })

    expect(didPlayerWin(match, player)).toBe(true)
  })

  it('should return false when player team lost', () => {
    const player = createMockPlayer({ team_id: 'Blue' })
    const match = createMockMatch({
      players: [player],
      teams: [
        { team_id: 'Blue', won: false },
        { team_id: 'Red', won: true },
      ],
    })

    expect(didPlayerWin(match, player)).toBe(false)
  })

  it('should be case insensitive for team_id', () => {
    const player = createMockPlayer({ team_id: 'blue' })
    const match = createMockMatch({
      players: [player],
      teams: [
        { team_id: 'Blue', won: true },
        { team_id: 'Red', won: false },
      ],
    })

    expect(didPlayerWin(match, player)).toBe(true)
  })

  it('should return false when team not found', () => {
    const player = createMockPlayer({ team_id: 'Unknown' })
    const match = createMockMatch({
      players: [player],
      teams: [
        { team_id: 'Blue', won: true },
        { team_id: 'Red', won: false },
      ],
    })

    expect(didPlayerWin(match, player)).toBe(false)
  })
})

describe('calculatePlayerStats', () => {
  describe('basic statistics', () => {
    it('should return zeroed stats for empty matches array', () => {
      const stats = calculatePlayerStats([], 'Player', 'TAG')

      expect(stats.totalGames).toBe(0)
      expect(stats.wins).toBe(0)
      expect(stats.winRate).toBe(0)
      expect(stats.totalKills).toBe(0)
      expect(stats.kd).toBe(0)
    })

    it('should count total games correctly', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: false }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.totalGames).toBe(3)
    })

    it('should skip matches where player is not found', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const otherPlayer = createMockPlayer({ name: 'Other', tag: 'OTHER' })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
        createMockMatch({ players: [otherPlayer], teams: [{ team_id: 'Blue', won: false }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.totalGames).toBe(1)
    })
  })

  describe('win rate calculation', () => {
    it('should calculate win rate correctly', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: false }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: false }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.wins).toBe(2)
      expect(stats.winRate).toBe(50)
    })

    it('should handle 100% win rate', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.winRate).toBe(100)
    })

    it('should handle 0% win rate', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: false }] }),
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: false }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.winRate).toBe(0)
    })
  })

  describe('kD and KDA calculation', () => {
    it('should calculate KD correctly', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 20, deaths: 10, assists: 5 })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.kd).toBe(2) // 20/10
    })

    it('should calculate KDA correctly', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 20, deaths: 10, assists: 5 })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.kda).toBe(2.5) // (20+5)/10
    })

    it('should handle zero deaths (perfect KD)', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 15, deaths: 0, assists: 5 })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.kd).toBe(15) // kills when no deaths
      expect(stats.kda).toBe(20) // kills + assists when no deaths
    })

    it('should handle zero kills and zero deaths', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 0, deaths: 0, assists: 0 })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.kd).toBe(0)
      expect(stats.kda).toBe(0)
    })

    it('should accumulate KDA across multiple matches', () => {
      const player1 = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 10, deaths: 5, assists: 2 })
      const player2 = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 15, deaths: 5, assists: 3 })
      const matches = [
        createMockMatch({ players: [player1], teams: [{ team_id: 'Blue', won: true }] }),
        createMockMatch({ players: [player2], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.totalKills).toBe(25) // 10 + 15
      expect(stats.totalDeaths).toBe(10) // 5 + 5
      expect(stats.totalAssists).toBe(5) // 2 + 3
      expect(stats.kd).toBe(2.5) // 25/10
      expect(stats.kda).toBe(3) // (25+5)/10
    })
  })

  describe('headshot rate calculation', () => {
    it('should calculate headshot rate correctly', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        headshots: 30,
        bodyshots: 50,
        legshots: 20,
      })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.headshotRate).toBe(30) // 30/100 * 100
    })

    it('should handle zero total shots', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        headshots: 0,
        bodyshots: 0,
        legshots: 0,
      })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.headshotRate).toBe(0)
    })

    it('should handle 100% headshot rate', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        headshots: 50,
        bodyshots: 0,
        legshots: 0,
      })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.headshotRate).toBe(100)
    })
  })

  describe('aCS calculation', () => {
    it('should calculate ACS correctly (score / rounds)', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', score: 5000 })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: Array.from({ length: 20 }, () => ({})), // 20 rounds
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.acs).toBe(250) // 5000/20
    })

    it('should handle zero rounds', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', score: 5000 })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: [],
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.acs).toBe(0)
    })
  })

  describe('damage statistics', () => {
    it('should calculate damage delta correctly', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        damage_dealt: 3000,
        damage_received: 2000,
      })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.damageDelta).toBe(1000) // 3000 - 2000
    })

    it('should handle negative damage delta', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        damage_dealt: 1500,
        damage_received: 2500,
      })
      const matches = [
        createMockMatch({ players: [player], teams: [{ team_id: 'Blue', won: true }] }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.damageDelta).toBe(-1000)
    })

    it('should calculate damage delta per round', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        damage_dealt: 3000,
        damage_received: 2000,
      })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: Array.from({ length: 20 }, () => ({})),
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.damageDeltaPerRound).toBe(50) // 1000/20
    })
  })

  describe('kills per round', () => {
    it('should calculate kills per round correctly', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 20 })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: Array.from({ length: 20 }, () => ({})),
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.killsPerRound).toBe(1) // 20/20
    })
  })

  describe('kAST estimation', () => {
    it('should estimate KAST correctly', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        kills: 15,
        deaths: 8,
        assists: 5,
      })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: Array.from({ length: 20 }, () => ({})),
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      // surviveRounds = 20 - 8 = 12
      // participationRounds = min(20, 15 + 5 + 12) = 20
      // KAST = (20/20) * 100 = 100, but capped at 100
      expect(stats.kast).toBeLessThanOrEqual(100)
      expect(stats.kast).toBeGreaterThan(0)
    })

    it('should cap KAST at 100%', () => {
      const player = createMockPlayer({
        name: 'Player',
        tag: 'TAG',
        kills: 30,
        deaths: 0,
        assists: 10,
      })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: Array.from({ length: 20 }, () => ({})),
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.kast).toBe(100)
    })

    it('should handle zero rounds for KAST', () => {
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const matches = [
        createMockMatch({
          players: [player],
          teams: [{ team_id: 'Blue', won: true }],
          rounds: [],
        }),
      ]

      const stats = calculatePlayerStats(matches, 'Player', 'TAG')
      expect(stats.kast).toBe(0)
    })
  })
})

describe('formatStat', () => {
  it('should format to 1 decimal place by default', () => {
    expect(formatStat(1.234)).toBe('1.2')
  })

  it('should round up correctly', () => {
    expect(formatStat(1.25)).toBe('1.3')
  })

  it('should format to custom decimal places', () => {
    expect(formatStat(1.234, 2)).toBe('1.23')
  })

  it('should format to 0 decimal places', () => {
    expect(formatStat(1.5, 0)).toBe('2')
  })

  it('should handle whole numbers', () => {
    expect(formatStat(5)).toBe('5.0')
  })

  it('should handle zero', () => {
    expect(formatStat(0)).toBe('0.0')
  })

  it('should handle negative numbers', () => {
    expect(formatStat(-1.5)).toBe('-1.5')
  })
})

describe('formatPercent', () => {
  it('should format to 1 decimal place and append %', () => {
    expect(formatPercent(45.67)).toBe('45.7%')
  })

  it('should format with custom decimal places', () => {
    expect(formatPercent(45.678, 2)).toBe('45.68%')
  })

  it('should handle 100%', () => {
    expect(formatPercent(100)).toBe('100.0%')
  })

  it('should handle 0%', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('should handle decimal percentages', () => {
    expect(formatPercent(0.5)).toBe('0.5%')
  })

  it('should handle negative percentages', () => {
    expect(formatPercent(-10.5)).toBe('-10.5%')
  })
})
