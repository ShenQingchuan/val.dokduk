import type { HenrikApiService } from './henrik-api.service.js'
import type { ValorantService } from './valorant.service.js'
import { Controller, Get, Inject, Param, Query } from '@nestjs/common'
import { HenrikApiService as HenrikApiServiceToken } from './henrik-api.service.js'
import { ValorantService as ValorantServiceToken } from './valorant.service.js'

@Controller('valorant')
export class ValorantController {
  constructor(
    @Inject(HenrikApiServiceToken) private readonly henrikApiService: HenrikApiService,
    @Inject(ValorantServiceToken) private readonly valorantService: ValorantService,
  ) {}

  /**
   * GET /api/valorant/account/:name/:tag
   * Get player account info
   */
  @Get('account/:name/:tag')
  async getAccount(
    @Param('name') name: string,
    @Param('tag') tag: string,
  ) {
    return this.henrikApiService.getAccount(name, tag)
  }

  /**
   * GET /api/valorant/mmr/:region/:name/:tag
   * Get player MMR/rank data
   */
  @Get('mmr/:region/:name/:tag')
  async getMMR(
    @Param('region') region: string,
    @Param('name') name: string,
    @Param('tag') tag: string,
  ) {
    return this.henrikApiService.getMMR(region, name, tag)
  }

  /**
   * GET /api/valorant/matches/:region/:name/:tag
   * Get player match history
   */
  @Get('matches/:region/:name/:tag')
  async getMatches(
    @Param('region') region: string,
    @Param('name') name: string,
    @Param('tag') tag: string,
    @Query('mode') mode?: string,
    @Query('size') size?: string,
    @Query('start') start?: string,
  ) {
    return this.henrikApiService.getMatches(region, name, tag, {
      mode,
      size: size ? Number.parseInt(size, 10) : undefined,
      start: start ? Number.parseInt(start, 10) : undefined,
    })
  }

  /**
   * GET /api/valorant/stored-matches/:region/:name/:tag
   * Get stored match history (cached data from Henrik's database)
   * Faster initial load, recommended for new users
   */
  @Get('stored-matches/:region/:name/:tag')
  async getStoredMatches(
    @Param('region') region: string,
    @Param('name') name: string,
    @Param('tag') tag: string,
    @Query('mode') mode?: string,
    @Query('size') size?: string,
    @Query('page') page?: string,
  ) {
    return this.henrikApiService.getStoredMatches(region, name, tag, {
      mode,
      size: size ? Number.parseInt(size, 10) : undefined,
      page: page ? Number.parseInt(page, 10) : undefined,
    })
  }

  /**
   * GET /api/valorant/match/:matchId
   * Get match details
   */
  @Get('match/:matchId')
  async getMatch(@Param('matchId') matchId: string) {
    return this.henrikApiService.getMatch(matchId)
  }

  /**
   * GET /api/valorant/player/:region/:name/:tag
   * BFF 聚合接口：获取玩家概览数据（账号、MMR、统计、比赛记录）
   */
  @Get('player/:region/:name/:tag')
  async getPlayerOverview(
    @Param('region') region: string,
    @Param('name') name: string,
    @Param('tag') tag: string,
    @Query('size') size?: string,
  ) {
    return this.valorantService.getPlayerOverview(
      name,
      tag,
      region,
      size ? Number.parseInt(size, 10) : 10,
    )
  }
}
