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
}
