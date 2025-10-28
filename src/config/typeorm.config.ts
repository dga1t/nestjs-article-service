import { ConfigService } from '@nestjs/config'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

import { createDatabaseOptions } from './database.config'

export const buildTypeOrmModuleOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const baseOptions = createDatabaseOptions({
    DATABASE_URL: configService.get<string>('DATABASE_URL') ?? undefined,
    DATABASE_SSL: configService.get<string>('DATABASE_SSL') ?? undefined,
    NODE_ENV: configService.get<string>('NODE_ENV') ?? undefined,
  })

  return {
    ...baseOptions,
    autoLoadEntities: true,
    synchronize: false,
  }
}
