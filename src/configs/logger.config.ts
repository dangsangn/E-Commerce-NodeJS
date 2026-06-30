import config from '.'

const NODE_ENV = process.env.NODE_ENV || 'development'

export const loggerConfig = {
  env: NODE_ENV,
  isProd: NODE_ENV === 'production',
  level: config.logging.level,
  dir: config.logging.dir,
  maxFiles: config.logging.maxFiles,
  maxSize: config.logging.maxSize,
  toFile: config.logging.toFile,
}
