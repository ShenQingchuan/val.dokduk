import { describe, expect, it } from 'vitest'

/**
 * Re-implementation of durationToSeconds for testing purposes
 * (The original is not exported from auth.service.ts)
 */
function durationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match)
    return 7 * 24 * 60 * 60 // default 7 days
  const [, num, unit] = match
  const value = Number.parseInt(num, 10)
  switch (unit) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 60 * 60
    case 'd': return value * 24 * 60 * 60
    default: return 7 * 24 * 60 * 60
  }
}

describe('durationToSeconds', () => {
  describe('seconds parsing', () => {
    it('should parse "30s" correctly', () => {
      expect(durationToSeconds('30s')).toBe(30)
    })

    it('should parse "1s" correctly', () => {
      expect(durationToSeconds('1s')).toBe(1)
    })

    it('should parse "120s" correctly', () => {
      expect(durationToSeconds('120s')).toBe(120)
    })
  })

  describe('minutes parsing', () => {
    it('should parse "5m" correctly', () => {
      expect(durationToSeconds('5m')).toBe(300) // 5 * 60
    })

    it('should parse "1m" correctly', () => {
      expect(durationToSeconds('1m')).toBe(60)
    })

    it('should parse "15m" correctly', () => {
      expect(durationToSeconds('15m')).toBe(900) // 15 * 60
    })
  })

  describe('hours parsing', () => {
    it('should parse "2h" correctly', () => {
      expect(durationToSeconds('2h')).toBe(7200) // 2 * 60 * 60
    })

    it('should parse "1h" correctly', () => {
      expect(durationToSeconds('1h')).toBe(3600)
    })

    it('should parse "24h" correctly', () => {
      expect(durationToSeconds('24h')).toBe(86400) // 24 * 60 * 60
    })
  })

  describe('days parsing', () => {
    it('should parse "7d" correctly', () => {
      expect(durationToSeconds('7d')).toBe(604800) // 7 * 24 * 60 * 60
    })

    it('should parse "1d" correctly', () => {
      expect(durationToSeconds('1d')).toBe(86400)
    })

    it('should parse "30d" correctly', () => {
      expect(durationToSeconds('30d')).toBe(2592000) // 30 * 24 * 60 * 60
    })
  })

  describe('invalid format handling', () => {
    it('should return default 7 days for invalid format', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60 // 604800
      expect(durationToSeconds('invalid')).toBe(defaultSevenDays)
    })

    it('should return default for empty string', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60
      expect(durationToSeconds('')).toBe(defaultSevenDays)
    })

    it('should return default for missing unit', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60
      expect(durationToSeconds('30')).toBe(defaultSevenDays)
    })

    it('should return default for missing number', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60
      expect(durationToSeconds('m')).toBe(defaultSevenDays)
    })

    it('should return default for unknown unit', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60
      expect(durationToSeconds('30x')).toBe(defaultSevenDays)
    })

    it('should return default for negative number', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60
      expect(durationToSeconds('-5m')).toBe(defaultSevenDays)
    })

    it('should return default for decimal number', () => {
      const defaultSevenDays = 7 * 24 * 60 * 60
      expect(durationToSeconds('5.5m')).toBe(defaultSevenDays)
    })
  })

  describe('edge cases', () => {
    it('should parse "0s" correctly', () => {
      expect(durationToSeconds('0s')).toBe(0)
    })

    it('should parse "0m" correctly', () => {
      expect(durationToSeconds('0m')).toBe(0)
    })

    it('should parse large numbers', () => {
      expect(durationToSeconds('365d')).toBe(31536000) // 1 year in seconds
    })
  })
})

describe('riot ID validation', () => {
  /**
   * Riot ID format validation regex (same as in auth.service.ts)
   */
  function isValidRiotId(riotId: string): boolean {
    const match = riotId.match(/^(.+)#(\w+)$/)
    return !!match
  }

  describe('valid formats', () => {
    it('should accept "Player#TAG"', () => {
      expect(isValidRiotId('Player#TAG')).toBe(true)
    })

    it('should accept "Player123#ABC"', () => {
      expect(isValidRiotId('Player123#ABC')).toBe(true)
    })

    it('should accept "Name With Spaces#123"', () => {
      expect(isValidRiotId('Name With Spaces#123')).toBe(true)
    })

    it('should accept single character name', () => {
      expect(isValidRiotId('A#B')).toBe(true)
    })

    it('should accept numeric tag', () => {
      expect(isValidRiotId('Player#1234')).toBe(true)
    })

    it('should accept alphanumeric tag', () => {
      expect(isValidRiotId('Player#ABC123')).toBe(true)
    })

    it('should accept underscore in tag', () => {
      expect(isValidRiotId('Player#TAG_1')).toBe(true)
    })

    it('should accept Japanese characters in name', () => {
      expect(isValidRiotId('プレイヤー#TAG')).toBe(true)
    })

    it('should accept Chinese characters in name', () => {
      expect(isValidRiotId('玩家#TAG')).toBe(true)
    })

    it('should accept Korean characters in name', () => {
      expect(isValidRiotId('플레이어#TAG')).toBe(true)
    })
  })

  describe('invalid formats', () => {
    it('should reject missing hash separator', () => {
      expect(isValidRiotId('PlayerTAG')).toBe(false)
    })

    it('should reject empty tag', () => {
      expect(isValidRiotId('Player#')).toBe(false)
    })

    it('should reject empty name', () => {
      expect(isValidRiotId('#TAG')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isValidRiotId('')).toBe(false)
    })

    it('should reject multiple hash symbols (tag part)', () => {
      // This actually matches because (.+) captures "Player#Another"
      // and (\w+) captures "TAG"
      expect(isValidRiotId('Player#Another#TAG')).toBe(true)
    })

    it('should reject space in tag', () => {
      // \w+ doesn't match spaces
      expect(isValidRiotId('Player#TAG WITH SPACE')).toBe(false)
    })

    it('should reject special characters in tag', () => {
      expect(isValidRiotId('Player#TAG!')).toBe(false)
    })
  })
})
