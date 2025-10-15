import 'reflect-metadata'

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, beforeEach, it, vi, Mock } from 'vitest'

import { ArticlesService } from '../../src/articles/services/articles.service'
import { ArticleEntity } from '../../src/articles/entities/article.entity'
import { CreateArticleDto } from '../../src/articles/dto/create-article.dto'
import { ListArticlesDto } from '../../src/articles/dto/list-articles.dto'
import { UpdateArticleDto } from '../../src/articles/dto/update-article.dto'
import { Repository } from 'typeorm'

type ArticlesRepositoryMock = {
  findOne: Mock
  create: Mock
  save: Mock
  delete: Mock
  createQueryBuilder: Mock
}

type QueryBuilderMock = {
  leftJoinAndSelect: Mock
  orderBy: Mock
  addOrderBy: Mock
  where: Mock
  andWhere: Mock
  skip: Mock
  take: Mock
  getManyAndCount: Mock
}

describe('ArticlesService', () => {
  let service: ArticlesService
  let repository: Repository<ArticleEntity> & ArticlesRepositoryMock
  let queryBuilder: QueryBuilderMock

  beforeEach(() => {
    vi.resetAllMocks()

    queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn(),
    }

    repository = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<ArticleEntity> & ArticlesRepositoryMock

    service = new ArticlesService(repository)
  })

  describe('findAll', () => {
    it('returns paginated result with defaults', async () => {
      const articles = [{ id: '1' }] as ArticleEntity[]
      queryBuilder.getManyAndCount.mockResolvedValue([articles, 1])

      const result = await service.findAll({ page: 1, limit: 10 } as unknown as ListArticlesDto)

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('article')
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('article.author', 'author')
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('article.publishedAt', 'DESC', 'NULLS LAST')
      expect(queryBuilder.skip).toHaveBeenCalledWith(0)
      expect(queryBuilder.take).toHaveBeenCalledWith(10)
      expect(queryBuilder.getManyAndCount).toHaveBeenCalled()
      expect(result).toEqual({
        items: articles,
        meta: { page: 1, limit: 10, total: 1 },
      })
    })

    it('applies filters when provided', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      const publishedFrom = new Date('2024-01-01T00:00:00.000Z')
      const publishedTo = new Date('2024-02-01T00:00:00.000Z')

      await service.findAll(
        {
          page: 2,
          limit: 5,
          authorId: 'author-id',
          publishedFrom,
          publishedTo,
          search: '  hello ',
        } as unknown as ListArticlesDto,
      )

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('article.authorId = :authorId', {
        authorId: 'author-id',
      })
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('article.publishedAt >= :publishedFrom', {
        publishedFrom,
      })
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('article.publishedAt <= :publishedTo', {
        publishedTo,
      })
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(article.title ILIKE :search OR article.description ILIKE :search)',
        { search: '%hello%' },
      )
      expect(queryBuilder.skip).toHaveBeenCalledWith(5)
      expect(queryBuilder.take).toHaveBeenCalledWith(5)
    })
  })

  describe('findById', () => {
    it('returns an article when found', async () => {
      const article = { id: '1' } as ArticleEntity
      ;(repository.findOne as Mock).mockResolvedValue(article)

      const result = await service.findById('1')

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: ['author'] })
      expect(result).toBe(article)
    })

    it('throws NotFoundException when article is missing', async () => {
      ;(repository.findOne as Mock).mockResolvedValue(null)

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('create', () => {
    it('saves and returns article with relations', async () => {
      const dto = {
        title: 'Title',
        description: 'Desc',
        publishedAt: new Date('2024-01-01T00:00:00.000Z'),
      } as unknown as CreateArticleDto
      const created = { id: '1', ...dto } as ArticleEntity
      const saved = { id: '1' } as ArticleEntity

      ;(repository.create as Mock).mockReturnValue(created)
      ;(repository.save as Mock).mockResolvedValue(saved)
      vi.spyOn(service, 'findById').mockResolvedValue({ id: '1' } as ArticleEntity)

      const result = await service.create('author-id', dto)

      expect(repository.create).toHaveBeenCalledWith({
        title: dto.title,
        description: dto.description,
        publishedAt: dto.publishedAt,
        authorId: 'author-id',
      })
      expect(repository.save).toHaveBeenCalledWith(created)
      expect(service.findById).toHaveBeenCalledWith('1')
      expect(result).toEqual({ id: '1' })
    })
  })

  describe('update', () => {
    it('updates fields when user is owner', async () => {
      const article = {
        id: '1',
        authorId: 'author-id',
        title: 'Old title',
        description: 'Old',
        publishedAt: null,
      } as ArticleEntity
      const payload = {
        title: 'New title',
        description: null,
        publishedAt: new Date('2024-01-02T00:00:00.000Z'),
      } as unknown as UpdateArticleDto

      vi.spyOn(service, 'findById').mockResolvedValue(article)
      ;(repository.save as Mock).mockImplementation(async (value: ArticleEntity) => value)

      const result = await service.update('author-id', '1', payload)

      expect(result.title).toBe(payload.title)
      expect(result.description).toBeNull()
      expect(result.publishedAt).toEqual(payload.publishedAt)
      expect(repository.save).toHaveBeenCalledWith(article)
    })

    it('throws when user is not owner', async () => {
      const article = { id: '1', authorId: 'another-id' } as ArticleEntity
      vi.spyOn(service, 'findById').mockResolvedValue(article)

      await expect(service.update('author-id', '1', {} as UpdateArticleDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })
  })

  describe('delete', () => {
    it('deletes when user is owner', async () => {
      const article = { id: '1', authorId: 'author-id' } as ArticleEntity
      vi.spyOn(service, 'findById').mockResolvedValue(article)

      await service.delete('author-id', '1')

      expect(repository.delete).toHaveBeenCalledWith('1')
    })

    it('throws when user is not owner', async () => {
      const article = { id: '1', authorId: 'another-id' } as ArticleEntity
      vi.spyOn(service, 'findById').mockResolvedValue(article)

      await expect(service.delete('author-id', '1')).rejects.toBeInstanceOf(ForbiddenException)
    })
  })
})
