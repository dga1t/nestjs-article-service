import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ZodValidationPipe())
  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  await app.listen(port)
  Logger.log(`Application is running on http://localhost:${port}`, 'Bootstrap')
}

bootstrap().catch((error) => {
  Logger.error('Failed to bootstrap the application', error.stack, 'Bootstrap')
  process.exit(1)
})
