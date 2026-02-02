import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { RedisModule } from './common/redis.module.js'
import { ConfigModule } from './components/config/index.js'
import { LoggerModule } from './components/logger/logger.module.js'
import { DatabaseModule } from './database/database.module.js'
import { RequestIdMiddleware } from './middlewares/request-id.middleware.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { RoomModule } from './modules/room/room.module.js'
import { ValorantModule } from './modules/valorant/valorant.module.js'

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    ValorantModule,
    RoomModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path')
  }
}
