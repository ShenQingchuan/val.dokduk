import { Controller, Get, Query } from '@nestjs/common'

@Controller('/')
export class AppController {
  @Get('ping')
  ping(@Query('msg') msg?: string) {
    return {
      msg: `Pong: ${msg}`,
    }
  }
}
