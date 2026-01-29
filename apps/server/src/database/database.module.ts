import type { Database } from './index.js'
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '../components/config/config.service.js'
import { createDatabase } from './index.js'

export const DATABASE_TOKEN = Symbol('DATABASE_TOKEN')

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: (configService: ConfigService): Database => {
        const env = configService.getAll()
        return createDatabase(env.DATABASE_URL)
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
