import * as path from 'path'
import * as dotenv from 'dotenv'
import { IConfig } from './IConfig'
import defaultConfig from './default'

const NODE_ENV = process.env.NODE_ENV || 'development'
dotenv.config()
dotenv.config({
  path: path.resolve(process.cwd(), `.env.${NODE_ENV}`),
})

const isProd = NODE_ENV === 'production'

const environmentConfig: Partial<IConfig> = {
  port: Number(process.env.PORT) || 3000,
  dbUrl: process.env.MONGODB_URI || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  logging: {
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    dir: process.env.LOG_DIR || 'logs',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    toFile: (process.env.LOG_TO_FILE || 'true') === 'true',
  },
  mailer: {
    from: process.env.SMTP_FROM!,
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
}

const config = { ...defaultConfig, ...environmentConfig } as IConfig

export default config
