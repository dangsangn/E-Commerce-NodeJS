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
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
}

const config = { ...defaultConfig, ...environmentConfig } as IConfig

export default config
