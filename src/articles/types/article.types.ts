import { PublicUser } from '../../auth/types/auth.types'

export interface ArticleListMeta {
  page: number
  limit: number
  total: number
}

export interface ArticleResponse {
  id: string
  title: string
  description: string | null
  publishedAt: string | null
  authorId: string
  author: PublicUser
  createdAt: string
  updatedAt: string
}

export interface ArticleListResult {
  items: ArticleResponse[]
  meta: ArticleListMeta
}
