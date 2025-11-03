import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { describe, expect, beforeEach, it, vi, Mock } from 'vitest'

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}))

import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'

import { AuthService } from '../../src/auth/auth.service'
import { LoginDto } from '../../src/auth/dto/login.dto'
import { RegisterDto } from '../../src/auth/dto/register.dto'
import { UserEntity } from '../../src/users/entities/user.entity'

type QueryBuilderMock = {
  addSelect: Mock
  where: Mock
  getOne: Mock
}

type RepositoryMock = {
  findOne: Mock
  create: Mock
  save: Mock
  createQueryBuilder: Mock
}

describe('AuthService', () => {
  let authService: AuthService
  let usersRepository: Repository<UserEntity> & RepositoryMock
  let queryBuilder: QueryBuilderMock
  let jwtService: JwtService & { signAsync: Mock }
  let configService: ConfigService & { get: Mock }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.clearAllMocks()

    queryBuilder = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
    }

    usersRepository = {
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<UserEntity> & RepositoryMock

    jwtService = {
      signAsync: vi.fn(),
    } as unknown as JwtService & { signAsync: Mock }

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_SECRET') {
          return 'test-secret'
        }
        if (key === 'JWT_EXPIRES_IN') {
          return '1h'
        }
        return undefined
      }),
    } as unknown as ConfigService & { get: Mock }

    authService = new AuthService(usersRepository, jwtService, configService)
  })

  describe('register', () => {
    it('creates a new user when email is not taken', async () => {
      const dto = { email: 'user@example.com', password: 'password123', name: 'John Doe' } as RegisterDto
      const savedUser = {
        id: 'uuid-1',
        email: dto.email,
        password: 'hashed-password',
        name: dto.name,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      } as UserEntity

      ;(usersRepository.findOne as Mock).mockResolvedValue(null)
      const hashMock = bcrypt.hash as unknown as Mock
      hashMock.mockResolvedValue('hashed-password')
      ;(usersRepository.create as Mock).mockReturnValue(savedUser)
      ;(usersRepository.save as Mock).mockResolvedValue(savedUser)

      const result = await authService.register(dto)

      expect(hashMock).toHaveBeenCalledWith(dto.password, 10)
      expect(usersRepository.create).toHaveBeenCalledWith({
        email: dto.email,
        password: 'hashed-password',
        name: dto.name,
      })
      expect(result).toEqual({
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        createdAt: savedUser.createdAt.toISOString(),
        updatedAt: savedUser.updatedAt.toISOString(),
      })
    })

    it('throws a ConflictException when email already exists', async () => {
      const dto = { email: 'user@example.com', password: 'password123' } as RegisterDto
      ;(usersRepository.findOne as Mock).mockResolvedValue({ id: 'existing-id' })

      await expect(authService.register(dto)).rejects.toThrow('Email is already registered')
    })
  })

  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      const dto = { email: 'user@example.com', password: 'password123' } as LoginDto
      const user = {
        id: 'uuid-1',
        email: dto.email,
        password: 'hashed-password',
      } as UserEntity

      queryBuilder.getOne.mockResolvedValue(user)
      const compareMock = bcrypt.compare as unknown as Mock
      compareMock.mockResolvedValue(true)
      ;(jwtService.signAsync as Mock).mockResolvedValue('jwt-token')

      const result = await authService.login(dto)

      expect(compareMock).toHaveBeenCalledWith(dto.password, user.password)
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: user.id, email: user.email },
        { secret: 'test-secret', expiresIn: '1h' },
      )
      expect(result).toEqual({ accessToken: 'jwt-token', expiresIn: '1h' })
    })

    it('throws UnauthorizedException when user is missing', async () => {
      const dto = { email: 'missing@example.com', password: 'password123' } as LoginDto
      queryBuilder.getOne.mockResolvedValue(null)

      await expect(authService.login(dto)).rejects.toThrow('Invalid credentials')
    })

    it('throws UnauthorizedException when password does not match', async () => {
      const dto = { email: 'user@example.com', password: 'wrong' } as LoginDto
      const user = { id: 'uuid-1', email: dto.email, password: 'hashed-password' } as UserEntity

      queryBuilder.getOne.mockResolvedValue(user)
      const compareMock = bcrypt.compare as unknown as Mock
      compareMock.mockResolvedValue(false)

      await expect(authService.login(dto)).rejects.toThrow('Invalid credentials')
    })
  })

  describe('getProfile', () => {
    it('returns user data when user exists', async () => {
      const user = {
        id: 'uuid-1',
        email: 'user@example.com',
        password: 'hashed-password',
        name: 'John Doe',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      } as UserEntity
      ;(usersRepository.findOne as Mock).mockResolvedValue(user)

      const result = await authService.getProfile(user.id)

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })
    })

    it('throws NotFoundException when user is not found', async () => {
      ;(usersRepository.findOne as Mock).mockResolvedValue(null)

      await expect(authService.getProfile('unknown')).rejects.toThrow('User not found')
    })
  })
})
