import { Module } from '@nestjs/common'
import { RoomController } from './room.controller.js'
import { RoomService } from './room.service.js'

@Module({
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
