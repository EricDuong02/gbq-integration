import { Injectable } from '@nestjs/common'
import { utilities as nestWinstonModuleUtilities } from 'nest-winston'
import * as winston from 'winston'

@Injectable()
export class CustomLoggerService {
  private logger: winston.Logger

  constructor() {
    const { combine, timestamp, printf } = winston.format
    const logFormat = printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`
    })
    this.logger = winston.createLogger({
      level: 'info',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json(),
        logFormat,
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          options: { flags: 'w' },
        }),
        new winston.transports.File({ filename: 'logs/app.log' }),
      ],
    })

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            nestWinstonModuleUtilities.format.nestLike(),
          ),
        }),
      )
    }
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context })
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context })
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context })
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context })
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context })
  }
}
