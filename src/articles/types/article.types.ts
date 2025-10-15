import { ArticleEntity } from '../entities/article.entity'

export interface ArticleListMeta {
  page: number
  limit: number
  total: number
}

export interface ArticleListResult {
  items: ArticleEntity[]
  meta: ArticleListMeta
}
