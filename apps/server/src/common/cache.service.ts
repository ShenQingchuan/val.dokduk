import type { Redis } from 'ioredis'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { REDIS_TOKEN } from './redis.module.js'

/**
 * Cache service with TTL support for Redis
 * Used for caching Henrik API responses and daily store data
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  /**
   * Get cached value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      if (!value)
        return null
      return JSON.parse(value) as T
    }
    catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set value with TTL (in seconds)
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
    }
    catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error)
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    }
    catch (error) {
      this.logger.error(`Cache del error for key ${key}:`, error)
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await this.redis.exists(key)) === 1
    }
    catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Get remaining TTL for a key (in seconds)
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key)
    }
    catch (error) {
      this.logger.error(`Cache ttl error for key ${key}:`, error)
      return -1
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    }
    catch (error) {
      this.logger.error(`Cache delPattern error for pattern ${pattern}:`, error)
    }
  }
}

/**
 * Cache key builders for consistent key naming
 */
export const CacheKeys = {
  // Henrik API cache keys
  playerAccount: (name: string, tag: string) => `valorant:account:${name}#${tag}`,
  playerMmr: (region: string, name: string, tag: string) => `valorant:mmr:${region}:${name}#${tag}`,
  playerMatches: (region: string, name: string, tag: string) => `valorant:matches:${region}:${name}#${tag}`,
  match: (matchId: string) => `valorant:match:${matchId}`,

  // Daily store cache (per user, resets daily)
  dailyStore: (puuid: string) => `store:daily:${puuid}`,
  wallet: (puuid: string) => `store:wallet:${puuid}`,
}

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  PLAYER_ACCOUNT: 3600, // 1 hour
  PLAYER_MMR: 300, // 5 minutes
  PLAYER_MATCHES: 120, // 2 minutes
  MATCH_DETAIL: 86400, // 24 hours (match data doesn't change)
  DAILY_STORE: 86400, // 24 hours (store resets daily)
  WALLET: 300, // 5 minutes
}
