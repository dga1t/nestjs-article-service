import 'reflect-metadata'
import 'dotenv/config'

import { DataSource } from 'typeorm'

import { createDatabaseOptions } from './config/database.config'

export const AppDataSource = new DataSource(createDatabaseOptions())

export default AppDataSource
