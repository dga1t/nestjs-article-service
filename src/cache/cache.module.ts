import { Global, Logger, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

import { REDIS_CLIENT, RedisClient } from './cache.constants'
import { CacheService } from './cache.service'
import { createRedisConfig } from '../config/redis.config'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<RedisClient> => {
        const { url: redisUrl } = createRedisConfig({
          REDIS_URL: configService.get<string>('REDIS_URL') ?? undefined,
        })
        if (!redisUrl) {
          Logger.warn('REDIS_URL is not configured. Cache is disabled.', 'CacheModule')
          return null
        }

        try {
          const client = new Redis(redisUrl, { lazyConnect: true })
          client.on('error', (error) =>
            Logger.warn(`Redis error: ${error.message}`, 'CacheModule'),
          )
          await client.connect()
          Logger.log(`Connected to Redis at ${redisUrl}`, 'CacheModule')
          return client
        } catch (error) {
          Logger.error(
            `Failed to connect to Redis at ${redisUrl}: ${(error as Error).message}`,
            'CacheModule',
          )
          return null
        }
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
