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
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { ZodResponse } from 'nestjs-zod'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { JwtPayload } from '../../auth/types/auth.types'
import { CreateArticleDto } from '../dto/create-article.dto'
import { ListArticlesDto } from '../dto/list-articles.dto'
import { UpdateArticleDto } from '../dto/update-article.dto'
import { ArticlesService } from '../services/articles.service'
import { ArticleListResult, ArticleResponse } from '../types/article.types'
import { ArticleListResponseDto, ArticleResponseDto } from '../dto/article-response.dto'

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @ZodResponse({ type: ArticleListResponseDto })
  async findAll(@Query() query: ListArticlesDto): Promise<ArticleListResult> {
    return this.articlesService.findAll(query)
  }

  @Get(':id')
  @ZodResponse({ type: ArticleResponseDto })
  async findById(@Param('id') id: string): Promise<ArticleResponse> {
    return this.articlesService.findById(id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ZodResponse({ status: HttpStatus.CREATED, type: ArticleResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreateArticleDto,
  ): Promise<ArticleResponse> {
    return this.articlesService.create(user.sub, payload)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ZodResponse({ type: ArticleResponseDto })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() payload: UpdateArticleDto,
  ): Promise<ArticleResponse> {
    return this.articlesService.update(user.sub, id, payload)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.articlesService.delete(user.sub, id)
  }
}
