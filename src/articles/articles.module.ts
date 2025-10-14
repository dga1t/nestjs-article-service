import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { ArticleEntity } from './entities/article.entity'
import { ArticlesController } from './controllers/articles.controller'
import { ArticlesService } from './services/articles.service'

@Module({
  imports: [TypeOrmModule.forFeature([ArticleEntity]), AuthModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
