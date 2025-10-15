import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'

import { REDIS_CLIENT, RedisClient } from './cache.constants'

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name)

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) {
      return null
    }

    try {
      const value = await this.redis.get(key)
      if (!value) {
        return null
      }

      return JSON.parse(value) as T
    } catch (error) {
      this.logger.warn(`Failed to get cache key ${key}: ${(error as Error).message}`)
      return null
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.redis) {
      return
    }

    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch (error) {
      this.logger.warn(`Failed to set cache key ${key}: ${(error as Error).message}`)
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redis) {
      return
    }

    try {
      await this.redis.del(key)
    } catch (error) {
      this.logger.warn(`Failed to delete cache key ${key}: ${(error as Error).message}`)
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (!this.redis || keys.length === 0) {
      return
    }

    try {
      await this.redis.del(...keys)
    } catch (error) {
      this.logger.warn(`Failed to delete cache keys: ${(error as Error).message}`)
    }
  }

  async addToSet(setKey: string, member: string): Promise<void> {
    if (!this.redis) {
      return
    }

    try {
      await this.redis.sadd(setKey, member)
    } catch (error) {
      this.logger.warn(`Failed to add member to set ${setKey}: ${(error as Error).message}`)
    }
  }

  async getSetMembers(setKey: string): Promise<string[]> {
    if (!this.redis) {
      return []
    }

    try {
      return await this.redis.smembers(setKey)
    } catch (error) {
      this.logger.warn(`Failed to fetch members for set ${setKey}: ${(error as Error).message}`)
      return []
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redis) {
      return
    }

    try {
      await this.redis.quit()
    } catch (error) {
      this.logger.warn(`Failed to close Redis connection: ${(error as Error).message}`)
    }
  }
}
