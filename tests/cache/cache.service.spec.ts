import { describe, expect, beforeEach, it, vi, Mock } from 'vitest'

import { CacheService } from '../../src/cache/cache.service'

const createRedisMock = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  sadd: vi.fn(),
  smembers: vi.fn(),
  quit: vi.fn(),
})

describe('CacheService', () => {
  let redis: ReturnType<typeof createRedisMock>
  let service: CacheService

  beforeEach(() => {
    redis = createRedisMock()
    service = new CacheService(redis as unknown as any)
  })

  it('returns parsed value when get succeeds', async () => {
    const payload = { foo: 'bar' }
    redis.get.mockResolvedValue(JSON.stringify(payload))

    const result = await service.get<typeof payload>('key')

    expect(redis.get).toHaveBeenCalledWith('key')
    expect(result).toEqual(payload)
  })

  it('returns null when value missing or parsing fails gracefully', async () => {
    redis.get.mockResolvedValue(null)

    await expect(service.get('key')).resolves.toBeNull()

    redis.get.mockResolvedValue('not-json')
    await expect(service.get('key')).resolves.toBeNull()
  })

  it('stores value with TTL when set is called', async () => {
    await service.set('key', { hello: 'world' }, 60)

    expect(redis.set).toHaveBeenCalledWith('key', JSON.stringify({ hello: 'world' }), 'EX', 60)
  })

  it('deletes keys and key sets', async () => {
    await service.deleteMany(['a', 'b'])
    expect(redis.del).toHaveBeenCalledWith('a', 'b')

    await service.delete('set-key')
    expect(redis.del).toHaveBeenCalledWith('set-key')
  })

  it('tracks members in a set and retrieves them', async () => {
    redis.smembers.mockResolvedValue(['key-1'])

    await service.addToSet('set', 'member')
    expect(redis.sadd).toHaveBeenCalledWith('set', 'member')

    const members = await service.getSetMembers('set')
    expect(redis.smembers).toHaveBeenCalledWith('set')
    expect(members).toEqual(['key-1'])
  })

  it('shuts down redis connection on destroy', async () => {
    await service.onModuleDestroy()

    expect(redis.quit).toHaveBeenCalled()
  })
})
