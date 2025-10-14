import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { AuthTokens, JwtPayload, PublicUser } from './types/auth.types'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() payload: RegisterDto): Promise<PublicUser> {
    return this.authService.register(payload)
  }

  @Post('login')
  login(@Body() credentials: LoginDto): Promise<AuthTokens> {
    return this.authService.login(credentials)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload): Promise<PublicUser> {
    return this.authService.getProfile(user.sub)
  }
}
