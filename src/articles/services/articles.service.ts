import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { CreateArticleDto } from '../dto/create-article.dto'
import { ListArticlesDto } from '../dto/list-articles.dto'
import { UpdateArticleDto } from '../dto/update-article.dto'
import { ArticleEntity } from '../entities/article.entity'
import { ArticleListResult } from '../types/article.types'

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articlesRepository: Repository<ArticleEntity>,
  ) {}

  async findAll(query: ListArticlesDto): Promise<ArticleListResult> {
    const { page, limit, authorId, publishedFrom, publishedTo, search } = query
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

    return {
      items,
      meta: {
        page,
        limit,
        total,
      },
    }
  }

  async findById(id: string): Promise<ArticleEntity> {
    const article = await this.articlesRepository.findOne({ where: { id }, relations: ['author'] })
    if (!article) {
      throw new NotFoundException('Article not found')
    }

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

    return this.articlesRepository.save(article)
  }

  async delete(authorId: string, id: string): Promise<void> {
    const article = await this.findById(id)
    this.assertOwnership(authorId, article)

    await this.articlesRepository.delete(id)
  }

  private assertOwnership(authorId: string, article: ArticleEntity): void {
    if (article.authorId !== authorId) {
      throw new ForbiddenException('You are not allowed to modify this article')
    }
  }
}
