export interface IConfig {
  port: number
  dbUrl: string
  cloudinaryCloudName: string
  cloudinaryApiKey: string
  cloudinaryApiSecret: string
  logging: {
    level: string
    dir: string
    maxFiles: string
    maxSize: string
    toFile: boolean
  }
  mailer: {
    from: string
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
  }
}
