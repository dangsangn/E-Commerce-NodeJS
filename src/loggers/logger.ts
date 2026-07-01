import { loggerConfig } from '@/configs/logger.config'
import winston from 'winston'
import { devFormat, prodFormat } from './formats'
import DailyRotateFile from 'winston-daily-rotate-file'

const { isProd, level, dir, maxFiles, toFile } = loggerConfig

const consoleFormat = isProd ? prodFormat : devFormat

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
]

// File transport is only enabled when LOG_TO_FILE=true (can be disabled when running K8s/console-only)
if (toFile) {
  transports.push(
    new DailyRotateFile({
      dirname: dir,
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles,
      format: prodFormat, // file is always in JSON format, even in dev
    }),
    new DailyRotateFile({
      level: 'error',
      dirname: dir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles,
      format: prodFormat,
    }),
  )
}

const logger = winston.createLogger({
  level,
  // Use the standard npm leveling tool: error/warn/info/http/verbose/debug/silly
  levels: winston.config.npm.levels,
  transports,
  // Catch unhandled exceptions and promise rejections → write to a separate file before the process dies.
  exceptionHandlers: toFile
    ? [
        new DailyRotateFile({
          dirname: dir,
          filename: 'exceptions-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxFiles,
          format: prodFormat,
        }),
      ]
    : [new winston.transports.Console({ format: consoleFormat })],
})

// Winston doesn't automatically catch unhandledRejection; enable this flag so it uses rejectionHandlers.
logger.rejections.handle()

export default logger
