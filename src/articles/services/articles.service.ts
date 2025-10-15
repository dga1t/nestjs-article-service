import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'crypto'
import { Repository } from 'typeorm'

import { CacheService } from '../../cache/cache.service'
import { CreateArticleDto } from '../dto/create-article.dto'
import { ListArticlesDto } from '../dto/list-articles.dto'
import { UpdateArticleDto } from '../dto/update-article.dto'
import { ArticleEntity } from '../entities/article.entity'
import { ArticleListResult } from '../types/article.types'

@Injectable()
export class ArticlesService {
  private static readonly ARTICLE_ITEM_PREFIX = 'articles:item:'
  private static readonly ARTICLE_LIST_SET_KEY = 'articles:list:keys'
  private static readonly ARTICLE_LIST_TTL = 60
  private static readonly ARTICLE_ITEM_TTL = 300

  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articlesRepository: Repository<ArticleEntity>,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(query: ListArticlesDto): Promise<ArticleListResult> {
    const normalizedQuery = this.normalizeListQuery(query)
    const cacheKey = this.buildListCacheKey(normalizedQuery)
    const cached = await this.cacheService.get<ArticleListResult>(cacheKey)

    if (cached) {
      const items = cached.items.map((item) => this.articlesRepository.create(item))
      return { items, meta: cached.meta }
    }

    const { page, limit, authorId, publishedFrom, publishedTo, search } = normalizedQuery
    const skip = (page - 1) * limit

    const queryBuilder = this.articlesRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .orderBy('article.publishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('article.createdAt', 'DESC')
      .where('1 = 1')

    if (authorId) {
      queryBuilder.andWhere('article.authorId = :authorId', { authorId })
    }

    if (publishedFrom) {
      queryBuilder.andWhere('article.publishedAt >= :publishedFrom', { publishedFrom })
    }

    if (publishedTo) {
      queryBuilder.andWhere('article.publishedAt <= :publishedTo', { publishedTo })
    }

    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const sanitizedSearch = trimmedSearch.replace(/[%_]/g, '\\$&')
      queryBuilder.andWhere(
        '(article.title ILIKE :search OR article.description ILIKE :search)',
        { search: `%${sanitizedSearch}%` },
      )
    }

    queryBuilder.skip(skip).take(limit)

    const [items, total] = await queryBuilder.getManyAndCount()
    const result: ArticleListResult = {
      items,
      meta: {
        page,
        limit,
        total,
      },
    }

    await this.cacheService.set(cacheKey, result, ArticlesService.ARTICLE_LIST_TTL)
    await this.cacheService.addToSet(ArticlesService.ARTICLE_LIST_SET_KEY, cacheKey)

    return result
  }

  async findById(id: string): Promise<ArticleEntity> {
    const cacheKey = this.buildArticleCacheKey(id)
    const cached = await this.cacheService.get<ArticleEntity>(cacheKey)
    if (cached) {
      return this.articlesRepository.create(cached)
    }

    const article = await this.articlesRepository.findOne({
      where: { id },
      relations: ['author'],
    })
    if (!article) {
      throw new NotFoundException('Article not found')
    }

    await this.cacheService.set(cacheKey, article, ArticlesService.ARTICLE_ITEM_TTL)

    return article
  }

  async create(authorId: string, payload: CreateArticleDto): Promise<ArticleEntity> {
    const article = this.articlesRepository.create({
      title: payload.title,
      description: payload.description ?? null,
      publishedAt: payload.publishedAt ?? null,
      authorId,
    })

    const savedArticle = await this.articlesRepository.save(article)
    await this.invalidateArticleCaches(savedArticle.id)

    return this.findById(savedArticle.id)
  }

  async update(authorId: string, id: string, payload: UpdateArticleDto): Promise<ArticleEntity> {
    const article = await this.findById(id)
    this.assertOwnership(authorId, article)

    if (payload.title !== undefined) {
      article.title = payload.title
    }
    if (payload.description !== undefined) {
      article.description = payload.description ?? null
    }
    if (payload.publishedAt !== undefined) {
      article.publishedAt = payload.publishedAt ?? null
    }

    await this.articlesRepository.save(article)
    await this.invalidateArticleCaches(id)

    return this.findById(id)
  }

  async delete(authorId: string, id: string): Promise<void> {
    const article = await this.findById(id)
    this.assertOwnership(authorId, article)

    await this.articlesRepository.delete(id)
    await this.invalidateArticleCaches(id)
  }

  private assertOwnership(authorId: string, article: ArticleEntity): void {
    if (article.authorId !== authorId) {
      throw new ForbiddenException('You are not allowed to modify this article')
    }
  }

  private buildArticleCacheKey(id: string): string {
    return `${ArticlesService.ARTICLE_ITEM_PREFIX}${id}`
  }

  private buildListCacheKey(query: ListArticlesDto): string {
    const filters = {
      authorId: query.authorId ?? null,
      publishedFrom: query.publishedFrom ? query.publishedFrom.toISOString() : null,
      publishedTo: query.publishedTo ? query.publishedTo.toISOString() : null,
      search: query.search?.trim() ?? null,
    }

    const filtersHash = createHash('sha256')
      .update(JSON.stringify(filters))
      .digest('hex')

    return `articles:list:${query.page}:${query.limit}:${filtersHash}`
  }

  private normalizeListQuery(query: ListArticlesDto): ListArticlesDto {
    return {
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      authorId: query.authorId,
      publishedFrom: query.publishedFrom,
      publishedTo: query.publishedTo,
      search: query.search,
    }
  }

  private async invalidateArticleCaches(articleId: string): Promise<void> {
    const listKeys = await this.cacheService.getSetMembers(ArticlesService.ARTICLE_LIST_SET_KEY)
    if (listKeys.length > 0) {
      await this.cacheService.deleteMany(listKeys)
    }
    await this.cacheService.delete(ArticlesService.ARTICLE_LIST_SET_KEY)
    await this.cacheService.delete(this.buildArticleCacheKey(articleId))
  }
}
