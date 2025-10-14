export interface JwtPayload {
  sub: string
  email: string
}

export interface AuthTokens {
  accessToken: string
  expiresIn: string
}

export interface PublicUser {
  id: string
  email: string
  name: string | null
  createdAt: Date
  updatedAt: Date
}
