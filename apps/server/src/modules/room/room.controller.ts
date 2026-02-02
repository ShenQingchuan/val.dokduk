import type { Request } from 'express'
import type { Observable } from 'rxjs'
import type { AuthenticatedUser } from '../auth/auth.dto.js'
import type { RoomEvent } from './room.service.js'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common'
import { map } from 'rxjs'
import { JwtAuthGuard, Public } from '../auth/auth.guard.js'
import {
  CreateRoomSchema,
  JoinRoomSchema,
  KickMemberSchema,
  LeaveRoomSchema,
  SendChatSchema,
  UpdateRoomCodeSchema,
  UpdateRoomSettingsSchema,
} from './room.dto.js'
import { RoomService } from './room.service.js'

interface RequestWithUser extends Request {
  user?: AuthenticatedUser
}

function formatZodError(error: { issues: ReadonlyArray<{ path: PropertyKey[], message: string }> }): string {
  return error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
}

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(
    @Inject(RoomService) private readonly roomService: RoomService,
  ) {}

  /**
   * 获取所有房间列表
   * GET /rooms
   */
  @Public()
  @Get()
  async listRooms() {
    const rooms = await this.roomService.listRooms()
    return { data: rooms }
  }

  /**
   * 获取用户当前所在的房间
   * GET /rooms/my
   */
  @Public()
  @Get('my')
  async getMyRoom(@Req() req: RequestWithUser) {
    const guestId = (req.query as { guestId?: string }).guestId
    const odId = req.user?.id || guestId
    if (!odId) {
      return { data: null }
    }

    const result = await this.roomService.findUserRoom(odId)
    return { data: result }
  }

  /**
   * 创建房间
   * POST /rooms
   * 仅登录用户可以创建房间
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRoom(@Body() body: unknown, @Req() req: RequestWithUser) {
    // 游客不能创建房间
    if (!req.user) {
      throw new BadRequestException('请先登录后再创建房间')
    }

    const result = CreateRoomSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    const userId = req.user.id
    const username = req.user.username
    // TODO: 从用户资料获取绑定的 riotId
    const riotId = undefined

    const state = await this.roomService.createRoom(result.data, userId, username, riotId)
    return { data: state }
  }

  /**
   * 获取房间状态
   * GET /rooms/:code
   */
  @Public()
  @Get(':code')
  async getRoomState(@Param('code') code: string) {
    const state = await this.roomService.getRoomState(code.toUpperCase())
    if (!state) {
      throw new NotFoundException('房间不存在')
    }
    return { data: state }
  }

  /**
   * 加入房间
   * POST /rooms/:code/join
   */
  @Public()
  @Post(':code/join')
  @HttpCode(HttpStatus.OK)
  async joinRoom(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const result = JoinRoomSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    const userId = req.user?.id
    const username = req.user?.username
    const riotId = undefined

    try {
      const state = await this.roomService.joinRoom(
        code.toUpperCase(),
        userId,
        result.data.guestId,
        username,
        riotId,
      )
      if (!state) {
        throw new NotFoundException('房间不存在')
      }
      return { data: state }
    }
    catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 离开房间
   * POST /rooms/:code/leave
   */
  @Public()
  @Post(':code/leave')
  @HttpCode(HttpStatus.OK)
  async leaveRoom(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const result = LeaveRoomSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    const odId = req.user?.id || result.data.guestId
    if (!odId) {
      throw new BadRequestException('需要提供 guestId')
    }

    const success = await this.roomService.leaveRoom(code.toUpperCase(), odId)
    if (!success) {
      throw new NotFoundException('房间不存在或不在房间中')
    }
    return { success: true }
  }

  /**
   * 踢出成员
   * POST /rooms/:code/kick
   */
  @Public()
  @Post(':code/kick')
  @HttpCode(HttpStatus.OK)
  async kickMember(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const result = KickMemberSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    // 踢人需要知道是谁在操作，优先用登录用户，否则需要从 body 获取
    const bodyWithGuestId = body as { guestId?: string }
    const ownerId = req.user?.id || bodyWithGuestId.guestId
    if (!ownerId) {
      throw new BadRequestException('需要提供 guestId')
    }

    try {
      const success = await this.roomService.kickMember(
        code.toUpperCase(),
        ownerId,
        result.data.targetId,
      )
      if (!success) {
        throw new NotFoundException('房间不存在或目标不在房间中')
      }
      return { success: true }
    }
    catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 重置房间
   * POST /rooms/:code/reset
   */
  @Public()
  @Post(':code/reset')
  @HttpCode(HttpStatus.OK)
  async resetRoom(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const bodyWithGuestId = body as { guestId?: string }
    const ownerId = req.user?.id || bodyWithGuestId.guestId
    if (!ownerId) {
      throw new BadRequestException('需要提供 guestId')
    }

    try {
      const state = await this.roomService.resetRoom(code.toUpperCase(), ownerId)
      if (!state) {
        throw new NotFoundException('房间不存在')
      }
      return { data: state }
    }
    catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 更新房间码
   * POST /rooms/:code/update-code
   */
  @Public()
  @Post(':code/update-code')
  @HttpCode(HttpStatus.OK)
  async updateRoomCode(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const result = UpdateRoomCodeSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    const bodyWithGuestId = body as { guestId?: string }
    const ownerId = req.user?.id || bodyWithGuestId.guestId
    if (!ownerId) {
      throw new BadRequestException('需要提供 guestId')
    }

    try {
      const state = await this.roomService.updateRoomCode(
        code.toUpperCase(),
        result.data.newCode.toUpperCase(),
        ownerId,
      )
      if (!state) {
        throw new NotFoundException('房间不存在')
      }
      return { data: state }
    }
    catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 更新房间设置（房间码和段位限制）
   * POST /rooms/:code/settings
   */
  @Public()
  @Post(':code/settings')
  @HttpCode(HttpStatus.OK)
  async updateRoomSettings(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const result = UpdateRoomSettingsSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    const bodyWithGuestId = body as { guestId?: string }
    const ownerId = req.user?.id || bodyWithGuestId.guestId
    if (!ownerId) {
      throw new BadRequestException('需要提供 guestId')
    }

    try {
      const state = await this.roomService.updateRoomSettings(
        code.toUpperCase(),
        ownerId,
        {
          newCode: result.data.newCode?.toUpperCase(),
          rankTiers: result.data.rankTiers,
        },
      )
      if (!state) {
        throw new NotFoundException('房间不存在')
      }
      return { data: state }
    }
    catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 发送聊天消息
   * POST /rooms/:code/chat
   */
  @Public()
  @Post(':code/chat')
  @HttpCode(HttpStatus.OK)
  async sendChat(
    @Param('code') code: string,
    @Body() body: unknown,
    @Req() req: RequestWithUser,
  ) {
    const result = SendChatSchema.safeParse(body)
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error))
    }

    const odId = req.user?.id || result.data.guestId
    if (!odId) {
      throw new BadRequestException('需要提供 guestId')
    }

    try {
      const message = await this.roomService.sendChat(
        code.toUpperCase(),
        odId,
        result.data.content,
      )
      if (!message) {
        throw new NotFoundException('房间不存在')
      }
      return { data: message }
    }
    catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message)
      }
      throw error
    }
  }

  /**
   * 订阅房间事件 (SSE)
   * GET /rooms/:code/events
   */
  @Public()
  @Sse(':code/events')
  subscribeEvents(@Param('code') code: string): Observable<MessageEvent> {
    const subject = this.roomService.subscribe(code.toUpperCase())

    return subject.pipe(
      map((event: RoomEvent) => ({
        data: JSON.stringify(event),
      } as MessageEvent)),
    )
  }
}
