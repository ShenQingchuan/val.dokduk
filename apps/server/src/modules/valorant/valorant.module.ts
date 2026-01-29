import { Module } from '@nestjs/common'
import { CacheService } from '../../common/cache.service.js'
import { HenrikApiService } from './henrik-api.service.js'
import { ValorantController } from './valorant.controller.js'
import { ValorantService } from './valorant.service.js'

@Module({
  controllers: [ValorantController],
  providers: [HenrikApiService, CacheService, ValorantService],
  exports: [HenrikApiService, ValorantService],
})
export class ValorantModule {}
