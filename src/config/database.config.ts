import { DataSourceOptions } from 'typeorm'

import { DEFAULT_DATABASE_URL } from './database.constants'

type EnvRecord = Record<string, string | undefined>

const toBoolean = (value?: string): boolean => value === 'true'

export const createDatabaseOptions = (env: EnvRecord = process.env): DataSourceOptions => {
  const databaseUrl = env.DATABASE_URL ?? DEFAULT_DATABASE_URL
  const shouldUseSsl = toBoolean(env.DATABASE_SSL)
  const nodeEnv = env.NODE_ENV ?? 'development'

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    logging: nodeEnv !== 'production',
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  }
}
