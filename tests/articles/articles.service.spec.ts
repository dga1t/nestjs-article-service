import 'reflect-metadata'

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { describe, expect, beforeEach, it, vi, Mock } from 'vitest'

import { ArticlesService } from '../../src/articles/services/articles.service'
import { ArticleEntity } from '../../src/articles/entities/article.entity'
import { CreateArticleDto } from '../../src/articles/dto/create-article.dto'
import { ListArticlesDto } from '../../src/articles/dto/list-articles.dto'
import { UpdateArticleDto } from '../../src/articles/dto/update-article.dto'
import { ArticleListResult } from '../../src/articles/types/article.types'
import { Repository } from 'typeorm'

const ARTICLE_LIST_SET_KEY = 'articles:list:keys'

interface ArticlesRepositoryMock extends Repository<ArticleEntity> {
  createQueryBuilder: Mock
  findOne: Mock
  create: Mock
  save: Mock
  delete: Mock
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

type CacheServiceMock = {
  get: Mock
  set: Mock
  addToSet: Mock
  getSetMembers: Mock
  deleteMany: Mock
  delete: Mock
}

describe('ArticlesService with caching', () => {
  let service: ArticlesService
  let repository: ArticlesRepositoryMock
  let queryBuilder: QueryBuilderMock
  let cache: CacheServiceMock

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
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      findOne: vi.fn(),
      create: vi.fn((value: unknown) => {
        if (Array.isArray(value)) {
          return value as ArticleEntity[]
        }
        return { ...(value as object) } as ArticleEntity
      }),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as ArticlesRepositoryMock

    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      addToSet: vi.fn().mockResolvedValue(undefined),
      getSetMembers: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    service = new ArticlesService(repository, cache as unknown as any)
  })

  describe('findAll', () => {
    const baseQuery = { page: 1, limit: 10 } as unknown as ListArticlesDto

    it('returns cached result when available', async () => {
      const cachedResult: ArticleListResult = {
        items: [{ id: '1', title: 'Cached' } as ArticleEntity],
        meta: { page: 1, limit: 10, total: 1 },
      }
      ;(cache.get as Mock).mockResolvedValue(cachedResult)

      const result = await service.findAll(baseQuery)

      expect(cache.get).toHaveBeenCalled()
      expect(repository.createQueryBuilder).not.toHaveBeenCalled()
      expect(result).toEqual({
        items: cachedResult.items,
        meta: cachedResult.meta,
      })
    })

    it('queries database and caches result when not cached', async () => {
      const articles = [{ id: '1' } as ArticleEntity]
      queryBuilder.getManyAndCount.mockResolvedValue([articles, 1])

      const result = await service.findAll(baseQuery)

      const expectedFilters = {
        authorId: null,
        publishedFrom: null,
        publishedTo: null,
        search: null,
      }
      const filtersHash = createHash('sha256')
        .update(JSON.stringify(expectedFilters))
        .digest('hex')
      const expectedKey = `articles:list:1:10:${filtersHash}`

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('article')
      expect(queryBuilder.skip).toHaveBeenCalledWith(0)
      expect(queryBuilder.take).toHaveBeenCalledWith(10)
      expect(cache.set).toHaveBeenCalledWith(expectedKey, result, 60)
      expect(cache.addToSet).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY, expectedKey)
      expect(result).toEqual({
        items: articles,
        meta: { page: 1, limit: 10, total: 1 },
      })
    })

    it('applies filters and search parameters', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0])

      const publishedFrom = new Date('2024-01-01T00:00:00.000Z')
      const publishedTo = new Date('2024-02-01T00:00:00.000Z')

      await service.findAll({
        page: 2,
        limit: 5,
        authorId: 'author-id',
        publishedFrom,
        publishedTo,
        search: '  demo%  ',
      } as unknown as ListArticlesDto)

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
        { search: '%demo\\%%' },
      )
      expect(queryBuilder.skip).toHaveBeenCalledWith(5)
      expect(queryBuilder.take).toHaveBeenCalledWith(5)
    })
  })

  describe('findById', () => {
    it('returns cached article when available', async () => {
      const cachedArticle = { id: '1', title: 'Cached article' } as ArticleEntity
      ;(cache.get as Mock).mockResolvedValue(cachedArticle)

      const result = await service.findById('1')

      expect(cache.get).toHaveBeenCalledWith('articles:item:1')
      expect(repository.findOne).not.toHaveBeenCalled()
      expect(result).toEqual(cachedArticle)
    })

    it('fetches from database and caches when missing', async () => {
      const article = { id: '1' } as ArticleEntity
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      const result = await service.findById('1')

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['author'],
      })
      expect(cache.set).toHaveBeenCalledWith('articles:item:1', article, 300)
      expect(result).toBe(article)
    })

    it('throws NotFoundException when article does not exist', async () => {
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(null)

      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('create', () => {
    it('saves article, invalidates caches, and returns persisted entity', async () => {
      const dto = {
        title: 'Title',
        description: 'Desc',
        publishedAt: null,
      } as unknown as CreateArticleDto
      const saved = { id: 'uuid-1', authorId: 'author-id' } as ArticleEntity

      ;(repository.create as Mock).mockReturnValue(saved)
      ;(repository.save as Mock).mockResolvedValue(saved)
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(saved)

      const result = await service.create('author-id', dto)

      expect(repository.save).toHaveBeenCalledWith(saved)
      expect(cache.getSetMembers).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(cache.delete).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(cache.delete).toHaveBeenCalledWith('articles:item:uuid-1')
      expect(result).toBe(saved)
    })
  })

  describe('update', () => {
    it('updates article when user is owner and refreshes cache', async () => {
      const article = {
        id: 'uuid-1',
        authorId: 'author-id',
        title: 'Old',
      } as ArticleEntity
      const payload = { title: 'New' } as UpdateArticleDto

      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValueOnce(article)
      ;(repository.save as Mock).mockResolvedValue(article)
      ;(repository.findOne as Mock).mockResolvedValueOnce({ ...article, title: 'New' })

      const result = await service.update('author-id', 'uuid-1', payload)

      expect(repository.save).toHaveBeenCalledWith(article)
      expect(cache.delete).toHaveBeenCalledWith('articles:item:uuid-1')
      expect(cache.delete).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(result.title).toBe('New')
    })

    it('throws when user is not the owner', async () => {
      const article = { id: 'uuid-1', authorId: 'other' } as ArticleEntity
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      await expect(service.update('author-id', 'uuid-1', {} as UpdateArticleDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })
  })

  describe('delete', () => {
    it('deletes article and clears caches', async () => {
      const article = { id: 'uuid-1', authorId: 'author-id' } as ArticleEntity
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      await service.delete('author-id', 'uuid-1')

      expect(repository.delete).toHaveBeenCalledWith('uuid-1')
      expect(cache.getSetMembers).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(cache.delete).toHaveBeenCalledWith('articles:item:uuid-1')
      expect(cache.delete).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
    })
  })
})
