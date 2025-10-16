import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodResponse } from 'nestjs-zod'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AuthService } from './auth.service'
import { PublicUserDto } from '../users/dto/user-response.dto'
import { AuthTokensDto } from './dto/auth-tokens.dto'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuthTokens, JwtPayload, PublicUser } from './types/auth.types'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ZodResponse({ status: HttpStatus.CREATED, type: PublicUserDto })
  register(@Body() payload: RegisterDto): Promise<PublicUser> {
    return this.authService.register(payload)
  }

  @Post('login')
  @ZodResponse({ type: AuthTokensDto })
  login(@Body() credentials: LoginDto): Promise<AuthTokens> {
    return this.authService.login(credentials)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ZodResponse({ type: PublicUserDto })
  async me(@CurrentUser() user: JwtPayload): Promise<PublicUser> {
    return this.authService.getProfile(user.sub)
  }
}
