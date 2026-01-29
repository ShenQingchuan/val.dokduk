import { Global, Module } from '@nestjs/common'
import { Redis } from 'ioredis'
import { ConfigService } from '../components/config/config.service.js'

export const REDIS_TOKEN = Symbol('REDIS_TOKEN')

@Global()
@Module({
  providers: [
    {
      provide: REDIS_TOKEN,
      useFactory: (configService: ConfigService): Redis => {
        const env = configService.getAll()
        return new Redis(env.REDIS_URL)
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_TOKEN],
})
export class RedisModule {}
