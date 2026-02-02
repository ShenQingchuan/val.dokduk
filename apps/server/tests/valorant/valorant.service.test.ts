import type { MatchData } from '../../src/modules/valorant/henrik-api.service.js'
import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HenrikApiService } from '../../src/modules/valorant/henrik-api.service.js'
import { ValorantService } from '../../src/modules/valorant/valorant.service.js'
import {
  createMockHenrikApiService,
  createMockMatch,
  createMockPlayer,
  createMockTeam,
} from '../helpers/mock-factories.js'

describe('valorantService', () => {
  let service: ValorantService
  let mockHenrikApi: ReturnType<typeof createMockHenrikApiService>

  beforeEach(async () => {
    mockHenrikApi = createMockHenrikApiService()

    const module = await Test.createTestingModule({
      providers: [
        ValorantService,
        { provide: HenrikApiService, useValue: mockHenrikApi },
      ],
    }).compile()

    service = module.get<ValorantService>(ValorantService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('calculatePlayerStats', () => {
    describe('basic statistics', () => {
      it('should return zeroed stats for empty matches array', () => {
        const stats = service.calculatePlayerStats([], 'Player', 'TAG')

        expect(stats.totalGames).toBe(0)
        expect(stats.wins).toBe(0)
        expect(stats.winRate).toBe(0)
        expect(stats.totalKills).toBe(0)
        expect(stats.kd).toBe(0)
        expect(stats.kda).toBe(0)
      })

      it('should count total games correctly', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
        const matches = [
          createMockMatch({ players: [player] }),
          createMockMatch({ players: [player] }),
          createMockMatch({ players: [player] }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.totalGames).toBe(3)
      })

      it('should skip matches where player is not found', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
        const otherPlayer = createMockPlayer({ name: 'Other', tag: 'OTHER' })
        const matches = [
          createMockMatch({ players: [player] }),
          createMockMatch({ players: [otherPlayer] }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.totalGames).toBe(1)
      })

      it('should skip matches with invalid data (no metadata)', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
        const validMatch = createMockMatch({ players: [player] })
        const invalidMatch = { players: [player] } as MatchData

        const stats = service.calculatePlayerStats([validMatch, invalidMatch], 'Player', 'TAG')
        expect(stats.totalGames).toBe(1)
      })

      it('should skip matches with no players array', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
        const validMatch = createMockMatch({ players: [player] })
        const invalidMatch = createMockMatch({})
        // @ts-expect-error intentionally invalid
        invalidMatch.players = undefined

        const stats = service.calculatePlayerStats([validMatch, invalidMatch], 'Player', 'TAG')
        expect(stats.totalGames).toBe(1)
      })
    })

    describe('win rate calculation', () => {
      it('should calculate win rate correctly', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG', team_id: 'Blue' })
        const winningTeams = [
          createMockTeam({ team_id: 'Blue', won: true }),
          createMockTeam({ team_id: 'Red', won: false }),
        ]
        const losingTeams = [
          createMockTeam({ team_id: 'Blue', won: false }),
          createMockTeam({ team_id: 'Red', won: true }),
        ]

        const matches = [
          createMockMatch({ players: [player], teams: winningTeams }),
          createMockMatch({ players: [player], teams: winningTeams }),
          createMockMatch({ players: [player], teams: losingTeams }),
          createMockMatch({ players: [player], teams: losingTeams }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.wins).toBe(2)
        expect(stats.winRate).toBe(50)
      })

      it('should handle 100% win rate', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG', team_id: 'Blue' })
        const winningTeams = [
          createMockTeam({ team_id: 'Blue', won: true }),
          createMockTeam({ team_id: 'Red', won: false }),
        ]

        const matches = [
          createMockMatch({ players: [player], teams: winningTeams }),
          createMockMatch({ players: [player], teams: winningTeams }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.winRate).toBe(100)
      })

      it('should handle 0% win rate', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG', team_id: 'Blue' })
        const losingTeams = [
          createMockTeam({ team_id: 'Blue', won: false }),
          createMockTeam({ team_id: 'Red', won: true }),
        ]

        const matches = [
          createMockMatch({ players: [player], teams: losingTeams }),
          createMockMatch({ players: [player], teams: losingTeams }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.winRate).toBe(0)
      })
    })

    describe('kD and KDA calculation', () => {
      it('should calculate KD correctly', () => {
        const player = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          kills: 20,
          deaths: 10,
          assists: 5,
        })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.kd).toBe(2) // 20/10
      })

      it('should calculate KDA correctly', () => {
        const player = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          kills: 20,
          deaths: 10,
          assists: 5,
        })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.kda).toBe(2.5) // (20+5)/10
      })

      it('should handle zero deaths (perfect KD)', () => {
        const player = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          kills: 15,
          deaths: 0,
          assists: 5,
        })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.kd).toBe(15) // kills when no deaths
        expect(stats.kda).toBe(20) // kills + assists when no deaths
      })

      it('should handle zero kills and zero deaths', () => {
        const player = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          kills: 0,
          deaths: 0,
          assists: 0,
        })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.kd).toBe(0)
        expect(stats.kda).toBe(0)
      })

      it('should accumulate KDA across multiple matches', () => {
        const player1 = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          kills: 10,
          deaths: 5,
          assists: 2,
        })
        const player2 = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          kills: 15,
          deaths: 5,
          assists: 3,
        })
        const matches = [
          createMockMatch({ players: [player1] }),
          createMockMatch({ players: [player2] }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.headshotRate).toBe(100)
      })
    })

    describe('aCS calculation', () => {
      it('should calculate ACS correctly (score / rounds)', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG', score: 5000 })
        const matches = [
          createMockMatch({
            players: [player],
            rounds: Array.from({ length: 20 }, () => ({})), // 20 rounds
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.acs).toBe(250) // 5000/20
      })

      it('should handle zero rounds', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG', score: 5000 })
        const matches = [
          createMockMatch({
            players: [player],
            rounds: [],
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.damageDelta).toBe(1000) // 3000 - 2000
      })

      it('should handle negative damage delta', () => {
        const player = createMockPlayer({
          name: 'Player',
          tag: 'TAG',
          damage_dealt: 1500,
          damage_received: 2500,
        })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
            rounds: Array.from({ length: 20 }, () => ({})),
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.damageDeltaPerRound).toBe(50) // 1000/20
      })
    })

    describe('kills per round', () => {
      it('should calculate kills per round correctly', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG', kills: 20 })
        const matches = [
          createMockMatch({
            players: [player],
            rounds: Array.from({ length: 20 }, () => ({})),
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
            rounds: Array.from({ length: 20 }, () => ({})),
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
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
            rounds: Array.from({ length: 20 }, () => ({})),
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.kast).toBe(100)
      })

      it('should handle zero rounds for KAST', () => {
        const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
        const matches = [
          createMockMatch({
            players: [player],
            rounds: [],
          }),
        ]

        const stats = service.calculatePlayerStats(matches, 'Player', 'TAG')
        expect(stats.kast).toBe(0)
      })
    })

    describe('case insensitivity', () => {
      it('should find player case-insensitively', () => {
        const player = createMockPlayer({ name: 'TestPlayer', tag: 'TAG' })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'testplayer', 'tag')
        expect(stats.totalGames).toBe(1)
      })

      it('should find player with uppercase search', () => {
        const player = createMockPlayer({ name: 'testplayer', tag: 'tag' })
        const matches = [createMockMatch({ players: [player] })]

        const stats = service.calculatePlayerStats(matches, 'TESTPLAYER', 'TAG')
        expect(stats.totalGames).toBe(1)
      })
    })
  })

  describe('getPlayerOverview', () => {
    it('should fetch and aggregate player data', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'ap' }
      const mockMMR = { current_data: { currenttier: 18, ranking_in_tier: 50 } }
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const mockMatches = [createMockMatch({ players: [player] })]

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockResolvedValue(mockMMR)
      mockHenrikApi.getMatches.mockResolvedValue(mockMatches)

      const result = await service.getPlayerOverview('Player', 'TAG')

      expect(result.account).toEqual(mockAccount)
      expect(result.mmr).toEqual(mockMMR)
      expect(result.matches).toHaveLength(1)
      expect(result.stats).not.toBeNull()
    })

    it('should handle MMR fetch failure gracefully', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'ap' }
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const mockMatches = [createMockMatch({ players: [player] })]

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockRejectedValue(new Error('MMR not found'))
      mockHenrikApi.getMatches.mockResolvedValue(mockMatches)

      const result = await service.getPlayerOverview('Player', 'TAG')

      expect(result.account).toEqual(mockAccount)
      expect(result.mmr).toBeNull()
      expect(result.stats).not.toBeNull()
    })

    it('should handle matches fetch failure gracefully', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'ap' }
      const mockMMR = { current_data: { currenttier: 18, ranking_in_tier: 50 } }

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockResolvedValue(mockMMR)
      mockHenrikApi.getMatches.mockRejectedValue(new Error('Matches not found'))

      const result = await service.getPlayerOverview('Player', 'TAG')

      expect(result.account).toEqual(mockAccount)
      expect(result.mmr).toEqual(mockMMR)
      expect(result.matches).toEqual([])
      expect(result.stats).toBeNull()
    })

    it('should return null stats when no valid matches', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'ap' }
      const mockMMR = { current_data: { currenttier: 18, ranking_in_tier: 50 } }

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockResolvedValue(mockMMR)
      mockHenrikApi.getMatches.mockResolvedValue([])

      const result = await service.getPlayerOverview('Player', 'TAG')

      expect(result.stats).toBeNull()
    })

    it('should filter out invalid matches', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'ap' }
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const validMatch = createMockMatch({ players: [player] })
      const invalidMatch = { players: [] } as MatchData // Invalid - no metadata

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockResolvedValue(null)
      mockHenrikApi.getMatches.mockResolvedValue([validMatch, invalidMatch])

      const result = await service.getPlayerOverview('Player', 'TAG')

      expect(result.matches).toHaveLength(1)
    })

    it('should sort matches by date descending', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'ap' }
      const player = createMockPlayer({ name: 'Player', tag: 'TAG' })
      const oldMatch = createMockMatch({
        players: [player],
        match_id: 'old-match',
        started_at: '2024-01-01T00:00:00Z',
      })
      const newMatch = createMockMatch({
        players: [player],
        match_id: 'new-match',
        started_at: '2024-01-10T00:00:00Z',
      })

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockResolvedValue(null)
      mockHenrikApi.getMatches.mockResolvedValue([oldMatch, newMatch])

      const result = await service.getPlayerOverview('Player', 'TAG')

      expect(result.matches[0].metadata.match_id).toBe('new-match')
      expect(result.matches[1].metadata.match_id).toBe('old-match')
    })

    it('should use custom region and matchSize', async () => {
      const mockAccount = { puuid: 'test-puuid', name: 'Player', tag: 'TAG', region: 'eu' }

      mockHenrikApi.getAccount.mockResolvedValue(mockAccount)
      mockHenrikApi.getMMR.mockResolvedValue(null)
      mockHenrikApi.getMatches.mockResolvedValue([])

      await service.getPlayerOverview('Player', 'TAG', 'eu', 20)

      expect(mockHenrikApi.getMMR).toHaveBeenCalledWith('eu', 'Player', 'TAG')
      expect(mockHenrikApi.getMatches).toHaveBeenCalledWith('eu', 'Player', 'TAG', { size: 20 })
    })
  })
})
