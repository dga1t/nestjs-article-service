export interface RedisConfig {
  url: string | null
}

type EnvRecord = Record<string, string | undefined>

export const createRedisConfig = (env: EnvRecord = process.env): RedisConfig => {
  const url = env.REDIS_URL ?? null
  return { url }
}
