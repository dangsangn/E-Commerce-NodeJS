import * as path from 'path'
import * as dotenv from 'dotenv'
import { IConfig } from './IConfig'
import defaultConfig from './default'

const NODE_ENV = process.env.NODE_ENV || 'development'
dotenv.config()
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${NODE_ENV}`),
})

const environmentConfig: Partial<IConfig> = {
  port: Number(process.env.PORT) || 3000,
  dbUrl: process.env.MONGODB_URI || '',
}

const config = { ...defaultConfig, ...environmentConfig } as IConfig

export default config
