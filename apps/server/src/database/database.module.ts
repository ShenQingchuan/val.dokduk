import type { Database } from './index.js'
import { Global, Logger, Module } from '@nestjs/common'
import { ConfigService } from '../components/config/config.service.js'
import { createDatabase } from './index.js'
import { runMigrations } from './migrate.js'

export const DATABASE_TOKEN = Symbol('DATABASE_TOKEN')

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: async (configService: ConfigService): Promise<Database> => {
        const logger = new Logger('DatabaseModule')
        const env = configService.getAll()

        // 生产环境自动运行迁移
        if (env.NODE_ENV === 'production') {
          logger.log('Running database migrations...')
          await runMigrations(env.DATABASE_URL)
          logger.log('Migrations completed')
        }

        return createDatabase(env.DATABASE_URL)
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
