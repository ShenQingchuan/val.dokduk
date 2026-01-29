import { Module } from '@nestjs/common'
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino'
import { loggerConfig } from './logger.config.js'

@Module({
  imports: [PinoLoggerModule.forRoot(loggerConfig)],
})
export class LoggerModule {}
