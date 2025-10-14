import 'reflect-metadata'

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, beforeEach, it, vi, Mock } from 'vitest'

import { ArticlesService } from '../../src/articles/services/articles.service'
import { ArticleEntity } from '../../src/articles/entities/article.entity'
import { CreateArticleDto } from '../../src/articles/dto/create-article.dto'
import { UpdateArticleDto } from '../../src/articles/dto/update-article.dto'
import { Repository } from 'typeorm'

type ArticlesRepositoryMock = {
  find: Mock
  findOne: Mock
  create: Mock
  save: Mock
  delete: Mock
}

describe('ArticlesService', () => {
  let service: ArticlesService
  let repository: Repository<ArticleEntity> & ArticlesRepositoryMock

  beforeEach(() => {
    vi.resetAllMocks()

    repository = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as Repository<ArticleEntity> & ArticlesRepositoryMock

    service = new ArticlesService(repository)
  })

  describe('findAll', () => {
    it('returns articles with authors', async () => {
      const articles = [{ id: '1' }] as ArticleEntity[]
      ;(repository.find as Mock).mockResolvedValue(articles)

      const result = await service.findAll()

      expect(repository.find).toHaveBeenCalledWith({ relations: ['author'] })
      expect(result).toBe(articles)
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
