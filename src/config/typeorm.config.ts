import { ConfigService } from '@nestjs/config'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/nestjs'

export const buildTypeOrmModuleOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL') ?? DEFAULT_DATABASE_URL
  const isProduction = configService.get<string>('NODE_ENV') === 'production'
  const shouldUseSsl = configService.get<string>('DATABASE_SSL', 'false') === 'true'

  return {
    type: 'postgres',
    url: databaseUrl,
    autoLoadEntities: true,
    synchronize: false,
    logging: !isProduction,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  }
}
