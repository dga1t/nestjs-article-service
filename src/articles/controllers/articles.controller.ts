import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { JwtPayload } from '../../auth/types/auth.types'
import { CreateArticleDto } from '../dto/create-article.dto'
import { ListArticlesDto } from '../dto/list-articles.dto'
import { UpdateArticleDto } from '../dto/update-article.dto'
import { ArticlesService } from '../services/articles.service'
import { ArticleListResult } from '../types/article.types'

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async findAll(@Query() query: ListArticlesDto): Promise<ArticleListResult> {
    return this.articlesService.findAll(query)
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.articlesService.findById(id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: JwtPayload, @Body() payload: CreateArticleDto) {
    return this.articlesService.create(user.sub, payload)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() payload: UpdateArticleDto,
  ) {
    return this.articlesService.update(user.sub, id, payload)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.articlesService.delete(user.sub, id)
  }
}
