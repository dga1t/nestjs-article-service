import { Logger } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import {
  ZodSerializerInterceptor,
  ZodValidationPipe,
  cleanupOpenApiDoc,
} from 'nestjs-zod'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalInterceptors(new ZodSerializerInterceptor(app.get(Reflector)))

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Articles API')
    .setDescription('REST API for authentication and article management')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build()

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('/api/docs', app, cleanupOpenApiDoc(swaggerDocument))
  
  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  await app.listen(port)
  Logger.log(`Application is running on http://localhost:${port}`, 'Bootstrap')
}

bootstrap().catch((error) => {
  Logger.error('Failed to bootstrap the application', error.stack, 'Bootstrap')
  process.exit(1)
})
