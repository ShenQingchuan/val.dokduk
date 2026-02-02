import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheKeys, CacheService, CacheTTL } from '../../src/common/cache.service.js'
import { REDIS_TOKEN } from '../../src/common/redis.module.js'
import { createMockRedis } from '../helpers/mock-factories.js'

describe('cacheService', () => {
  let service: CacheService
  let mockRedis: ReturnType<typeof createMockRedis>

  beforeEach(async () => {
    mockRedis = createMockRedis()

    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile()

    service = module.get<CacheService>(CacheService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('should return parsed JSON when key exists', async () => {
      const testData = { name: 'test', value: 123 }
      mockRedis.get.mockResolvedValue(JSON.stringify(testData))

      const result = await service.get('testKey')

      expect(result).toEqual(testData)
      expect(mockRedis.get).toHaveBeenCalledWith('testKey')
    })

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await service.get('nonexistent')

      expect(result).toBeNull()
    })

    it('should return null when key has empty string', async () => {
      mockRedis.get.mockResolvedValue('')

      const result = await service.get('emptyKey')

      expect(result).toBeNull()
    })

    it('should return null and log error when JSON parse fails', async () => {
      mockRedis.get.mockResolvedValue('invalid json {')

      const result = await service.get('invalidJson')

      expect(result).toBeNull()
    })

    it('should return null and handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

      const result = await service.get('errorKey')

      expect(result).toBeNull()
    })

    it('should handle array data', async () => {
      const testArray = [1, 2, 3, 'test']
      mockRedis.get.mockResolvedValue(JSON.stringify(testArray))

      const result = await service.get<(number | string)[]>('arrayKey')

      expect(result).toEqual(testArray)
    })

    it('should handle nested object data', async () => {
      const nestedData = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      }
      mockRedis.get.mockResolvedValue(JSON.stringify(nestedData))

      const result = await service.get('nestedKey')

      expect(result).toEqual(nestedData)
    })
  })

  describe('set', () => {
    it('should call setex with correct arguments', async () => {
      const testData = { name: 'test' }

      await service.set('testKey', testData, 300)

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'testKey',
        300,
        JSON.stringify(testData),
      )
    })

    it('should serialize arrays correctly', async () => {
      const testArray = [1, 2, 3]

      await service.set('arrayKey', testArray, 60)

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'arrayKey',
        60,
        '[1,2,3]',
      )
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'))

      // Should not throw
      await expect(service.set('errorKey', { data: 'test' }, 100)).resolves.toBeUndefined()
    })

    it('should handle null values', async () => {
      await service.set('nullKey', null, 100)

      expect(mockRedis.setex).toHaveBeenCalledWith('nullKey', 100, 'null')
    })

    it('should handle boolean values', async () => {
      await service.set('boolKey', true, 100)

      expect(mockRedis.setex).toHaveBeenCalledWith('boolKey', 100, 'true')
    })
  })

  describe('del', () => {
    it('should call del with correct key', async () => {
      await service.del('testKey')

      expect(mockRedis.del).toHaveBeenCalledWith('testKey')
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'))

      await expect(service.del('errorKey')).resolves.toBeUndefined()
    })
  })

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1)

      const result = await service.exists('existingKey')

      expect(result).toBe(true)
    })

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0)

      const result = await service.exists('nonexistent')

      expect(result).toBe(false)
    })

    it('should return false on Redis error', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'))

      const result = await service.exists('errorKey')

      expect(result).toBe(false)
    })
  })

  describe('ttl', () => {
    it('should return TTL value when key exists', async () => {
      mockRedis.ttl.mockResolvedValue(300)

      const result = await service.ttl('testKey')

      expect(result).toBe(300)
    })

    it('should return -2 when key does not exist', async () => {
      mockRedis.ttl.mockResolvedValue(-2)

      const result = await service.ttl('nonexistent')

      expect(result).toBe(-2)
    })

    it('should return -1 when key exists but has no TTL', async () => {
      mockRedis.ttl.mockResolvedValue(-1)

      const result = await service.ttl('noTtlKey')

      expect(result).toBe(-1)
    })

    it('should return -1 on Redis error', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'))

      const result = await service.ttl('errorKey')

      expect(result).toBe(-1)
    })
  })

  describe('delPattern', () => {
    it('should delete all keys matching pattern', async () => {
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3'])

      await service.delPattern('key*')

      expect(mockRedis.keys).toHaveBeenCalledWith('key*')
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3')
    })

    it('should not call del when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([])

      await service.delPattern('nonexistent*')

      expect(mockRedis.keys).toHaveBeenCalledWith('nonexistent*')
      expect(mockRedis.del).not.toHaveBeenCalled()
    })

    it('should handle Redis errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'))

      await expect(service.delPattern('error*')).resolves.toBeUndefined()
    })
  })
})

describe('cacheKeys', () => {
  describe('playerAccount', () => {
    it('should generate correct key format', () => {
      expect(CacheKeys.playerAccount('Player', 'TAG')).toBe('valorant:account:Player#TAG')
    })

    it('should preserve case', () => {
      expect(CacheKeys.playerAccount('PlayerName', 'ABC')).toBe('valorant:account:PlayerName#ABC')
    })
  })

  describe('playerMmr', () => {
    it('should generate correct key format with region', () => {
      expect(CacheKeys.playerMmr('ap', 'Player', 'TAG')).toBe('valorant:mmr:ap:Player#TAG')
    })

    it('should work with different regions', () => {
      expect(CacheKeys.playerMmr('eu', 'Player', 'TAG')).toBe('valorant:mmr:eu:Player#TAG')
      expect(CacheKeys.playerMmr('na', 'Player', 'TAG')).toBe('valorant:mmr:na:Player#TAG')
    })
  })

  describe('playerMatches', () => {
    it('should generate correct key format', () => {
      expect(CacheKeys.playerMatches('ap', 'Player', 'TAG')).toBe('valorant:matches:ap:Player#TAG')
    })
  })

  describe('match', () => {
    it('should generate correct key format', () => {
      expect(CacheKeys.match('abc123')).toBe('valorant:match:abc123')
    })
  })

  describe('dailyStore', () => {
    it('should generate correct key format', () => {
      expect(CacheKeys.dailyStore('puuid-123')).toBe('store:daily:puuid-123')
    })
  })

  describe('wallet', () => {
    it('should generate correct key format', () => {
      expect(CacheKeys.wallet('puuid-123')).toBe('store:wallet:puuid-123')
    })
  })
})

describe('cacheTTL', () => {
  it('should have correct PLAYER_ACCOUNT TTL (1 hour)', () => {
    expect(CacheTTL.PLAYER_ACCOUNT).toBe(3600)
  })

  it('should have correct PLAYER_MMR TTL (5 minutes)', () => {
    expect(CacheTTL.PLAYER_MMR).toBe(300)
  })

  it('should have correct PLAYER_MATCHES TTL (2 minutes)', () => {
    expect(CacheTTL.PLAYER_MATCHES).toBe(120)
  })

  it('should have correct MATCH_DETAIL TTL (24 hours)', () => {
    expect(CacheTTL.MATCH_DETAIL).toBe(86400)
  })

  it('should have correct DAILY_STORE TTL (24 hours)', () => {
    expect(CacheTTL.DAILY_STORE).toBe(86400)
  })

  it('should have correct WALLET TTL (5 minutes)', () => {
    expect(CacheTTL.WALLET).toBe(300)
  })
})
