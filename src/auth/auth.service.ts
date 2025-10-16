import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'

import { UserEntity } from '../users/entities/user.entity'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { AuthTokens, JwtPayload, PublicUser } from './types/auth.types'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(payload: RegisterDto): Promise<PublicUser> {
    const existingUser = await this.usersRepository.findOne({ where: { email: payload.email } })
    if (existingUser) {
      throw new ConflictException('Email is already registered')
    }

    const passwordHash = await bcrypt.hash(payload.password, 10)
    const userToCreate = this.usersRepository.create({
      email: payload.email,
      password: passwordHash,
      name: payload.name ?? null,
    })

    const savedUser = await this.usersRepository.save(userToCreate)
    return this.toPublicUser(savedUser)
  }

  async login(credentials: LoginDto): Promise<AuthTokens> {
    const user = await this.usersRepository.findOne({ where: { email: credentials.email } })
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const payload: JwtPayload = { sub: user.id, email: user.email }
    const secret = this.configService.get<string>('JWT_SECRET') ?? 'dev-secret'
    const expiresInConfig = this.configService.get<string>('JWT_EXPIRES_IN') ?? '1h'
    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: expiresInConfig as JwtSignOptions['expiresIn'],
    })

    return { accessToken, expiresIn: expiresInConfig }
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({ where: { id: userId } })
    if (!user) {
      throw new NotFoundException('User not found')
    }

    return this.toPublicUser(user)
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  }
}
