import 'reflect-metadata'
import 'dotenv/config'

import { DataSource } from 'typeorm'

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/nestjs'

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
const shouldUseSsl = process.env.DATABASE_SSL === 'true'

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  logging: process.env.NODE_ENV !== 'production',
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
})

export default AppDataSource
