import 'reflect-metadata'

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest'
import { Repository } from 'typeorm'

import { CreateArticleDto } from '../../src/articles/dto/create-article.dto'
import { ListArticlesDto } from '../../src/articles/dto/list-articles.dto'
import { UpdateArticleDto } from '../../src/articles/dto/update-article.dto'
import { ArticleEntity } from '../../src/articles/entities/article.entity'
import { ArticlesService } from '../../src/articles/services/articles.service'
import { ArticleListResult, ArticleResponse } from '../../src/articles/types/article.types'

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

const makeAuthor = (overrides: Partial<ArticleEntity['author']> = {}) => ({
  id: 'author-id',
  email: 'author@example.com',
  password: 'hash',
  name: 'Author',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
})

const makeArticle = (overrides: Partial<ArticleEntity> = {}): ArticleEntity => ({
  id: 'article-id',
  title: 'Sample',
  description: null,
  publishedAt: new Date('2024-03-01T00:00:00.000Z'),
  authorId: 'author-id',
  author: makeAuthor(),
  createdAt: new Date('2024-03-02T00:00:00.000Z'),
  updatedAt: new Date('2024-03-03T00:00:00.000Z'),
  ...overrides,
})

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
      create: vi.fn((value: unknown) => ({ ...(value as Record<string, unknown>) } as ArticleEntity)),
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
        items: [
          {
            id: '1',
            title: 'Cached',
            description: null,
            publishedAt: null,
            authorId: 'author-id',
            author: {
              id: 'author-id',
              email: 'author@example.com',
              name: 'Author',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            createdAt: '2024-03-02T00:00:00.000Z',
            updatedAt: '2024-03-03T00:00:00.000Z',
          },
        ],
        meta: { page: 1, limit: 10, total: 1 },
      }
      ;(cache.get as Mock).mockResolvedValue(cachedResult)

      const result = await service.findAll(baseQuery)

      expect(cache.get).toHaveBeenCalled()
      expect(repository.createQueryBuilder).not.toHaveBeenCalled()
      expect(result).toEqual(cachedResult)
    })

    it('queries database and caches result when not cached', async () => {
      const articleEntity = makeArticle({ id: '1' })
      queryBuilder.getManyAndCount.mockResolvedValue([[articleEntity], 1])

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

      const expectedItem: ArticleResponse = {
        id: '1',
        title: 'Sample',
        description: null,
        publishedAt: '2024-03-01T00:00:00.000Z',
        authorId: 'author-id',
        author: {
          id: 'author-id',
          email: 'author@example.com',
          name: 'Author',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        createdAt: '2024-03-02T00:00:00.000Z',
        updatedAt: '2024-03-03T00:00:00.000Z',
      }

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('article')
      expect(queryBuilder.skip).toHaveBeenCalledWith(0)
      expect(queryBuilder.take).toHaveBeenCalledWith(10)
      expect(cache.set).toHaveBeenCalledWith(
        expectedKey,
        {
          items: [expectedItem],
          meta: { page: 1, limit: 10, total: 1 },
        },
        60,
      )
      expect(cache.addToSet).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY, expectedKey)
      expect(result).toEqual({
        items: [expectedItem],
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
      const cachedArticle: ArticleResponse = {
        id: '1',
        title: 'Cached article',
        description: null,
        publishedAt: null,
        authorId: 'author-id',
        author: {
          id: 'author-id',
          email: 'author@example.com',
          name: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        createdAt: '2024-03-02T00:00:00.000Z',
        updatedAt: '2024-03-03T00:00:00.000Z',
      }
      ;(cache.get as Mock).mockResolvedValue(cachedArticle)

      const result = await service.findById('1')

      expect(cache.get).toHaveBeenCalledWith('articles:item:1')
      expect(repository.findOne).not.toHaveBeenCalled()
      expect(result).toEqual(cachedArticle)
    })

    it('fetches from database and caches when missing', async () => {
      const article = makeArticle({ id: '1' })
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      const result = await service.findById('1')

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['author'],
      })
      expect(cache.set).toHaveBeenCalledWith('articles:item:1', expect.any(Object), 300)
      expect(result.id).toBe('1')
      expect(result.author.email).toBe('author@example.com')
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
      const saved = makeArticle({ id: 'uuid-1', publishedAt: null })

      ;(repository.create as Mock).mockReturnValue(saved)
      ;(repository.save as Mock).mockResolvedValue(saved)
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValueOnce(saved)

      const result = await service.create('author-id', dto)

      expect(repository.save).toHaveBeenCalledWith(saved)
      expect(cache.getSetMembers).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(cache.delete).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(cache.delete).toHaveBeenCalledWith('articles:item:uuid-1')
      expect(result.id).toBe('uuid-1')
      expect(result.author.email).toBe('author@example.com')
    })
  })

  describe('update', () => {
    it('updates article when user is owner and refreshes cache', async () => {
      const article = makeArticle({ id: 'uuid-1', title: 'Old' })
      const payload = { title: 'New' } as UpdateArticleDto

      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValueOnce(article)
      ;(repository.save as Mock).mockResolvedValue(article)
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValueOnce({ ...article, title: 'New' })

      const result = await service.update('author-id', 'uuid-1', payload)

      expect(repository.save).toHaveBeenCalledWith(article)
      expect(cache.delete).toHaveBeenCalledWith('articles:item:uuid-1')
      expect(cache.delete).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(result.title).toBe('New')
    })

    it('throws when user is not the owner', async () => {
      const article = makeArticle({ authorId: 'other' })
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      await expect(service.update('author-id', 'uuid-1', {} as UpdateArticleDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })
  })

  describe('delete', () => {
    it('deletes article and clears caches', async () => {
      const article = makeArticle({ id: 'uuid-1' })
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      await service.delete('author-id', 'uuid-1')

      expect(repository.delete).toHaveBeenCalledWith('uuid-1')
      expect(cache.getSetMembers).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
      expect(cache.delete).toHaveBeenCalledWith('articles:item:uuid-1')
      expect(cache.delete).toHaveBeenCalledWith(ARTICLE_LIST_SET_KEY)
    })

    it('throws when user is not owner', async () => {
      const article = makeArticle({ authorId: 'another-id' })
      ;(cache.get as Mock).mockResolvedValueOnce(null)
      ;(repository.findOne as Mock).mockResolvedValue(article)

      await expect(service.delete('author-id', 'uuid-1')).rejects.toBeInstanceOf(ForbiddenException)
    })
  })
})
