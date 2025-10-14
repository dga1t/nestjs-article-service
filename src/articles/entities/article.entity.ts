import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm'

import { UserEntity } from '../../users/entities/user.entity'

@Entity({ name: 'articles' })
@Index(['authorId'])
@Index(['publishedAt'])
export class ArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 200 })
  title!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'published_at' })
  publishedAt!: Date | null

  @Column({ type: 'uuid', name: 'author_id' })
  authorId!: string

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author!: UserEntity

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
