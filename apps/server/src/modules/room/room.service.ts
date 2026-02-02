import type { Redis } from 'ioredis'
import type {
  ChatMessage,
  CreateRoomDto,
  RankTier,
  Room,
  RoomMember,
  RoomState,
  UpdateRoomSettingsDto,
} from './room.dto.js'
import { randomUUID } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Subject } from 'rxjs'
import { REDIS_TOKEN } from '../../common/redis.module.js'

// Redis key helpers
const RoomKeys = {
  room: (code: string) => `room:${code}`,
  members: (code: string) => `room:${code}:members`,
  chat: (code: string) => `room:${code}:chat`,
  allRooms: () => 'room:all', // Set of all room codes
}

// SSE event types
export interface RoomEvent {
  type: 'state' | 'member_join' | 'member_leave' | 'chat' | 'room_closed' | 'owner_change'
  data: unknown
}

const MAX_CHAT_MESSAGES = 100

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name)

  // 每个房间的 SSE 订阅者
  private roomSubscribers = new Map<string, Set<Subject<RoomEvent>>>()

  constructor(
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  /**
   * 获取用户显示名
   */
  private getDisplayName(userId: string, isGuest: boolean, username?: string, riotId?: string): string {
    if (riotId)
      return riotId
    if (!isGuest && username)
      return username
    return `游客_${userId.slice(0, 4).toUpperCase()}`
  }

  /**
   * 创建房间
   */
  async createRoom(dto: CreateRoomDto, userId?: string, username?: string, riotId?: string): Promise<RoomState> {
    const isGuest = !userId
    const odId = userId || dto.guestId || randomUUID()

    // 使用用户提供的房间码
    const code = dto.roomCode

    // 检查房间码是否已存在
    if (await this.redis.exists(RoomKeys.room(code))) {
      throw new Error('房间码已被使用')
    }

    const maxPlayers = dto.gameMode === '2v2' ? 2 : dto.gameMode === '3v3' ? 3 : 5

    const room: Room = {
      id: randomUUID(),
      code,
      ownerId: odId,
      ownerIsGuest: isGuest,
      gameMode: dto.gameMode,
      maxPlayers,
      status: 'waiting',
      rankTiers: dto.rankTiers,
      createdAt: Date.now(),
    }

    const member: RoomMember = {
      odId,
      isGuest,
      username: this.getDisplayName(odId, isGuest, username, riotId),
      riotId,
      joinedAt: Date.now(),
    }

    // 保存到 Redis
    await this.redis.set(RoomKeys.room(code), JSON.stringify(room))
    await this.redis.hset(RoomKeys.members(code), odId, JSON.stringify(member))
    await this.redis.sadd(RoomKeys.allRooms(), code)

    this.logger.log(`Room created: ${code} by ${member.username}`)

    return {
      room,
      members: [member],
      chat: [],
    }
  }

  /**
   * 获取房间状态
   */
  async getRoomState(code: string): Promise<RoomState | null> {
    const roomJson = await this.redis.get(RoomKeys.room(code))
    if (!roomJson)
      return null

    const room: Room = JSON.parse(roomJson)
    const membersHash = await this.redis.hgetall(RoomKeys.members(code))
    const members: RoomMember[] = Object.values(membersHash).map(m => JSON.parse(m))
    const chatJson = await this.redis.lrange(RoomKeys.chat(code), 0, MAX_CHAT_MESSAGES - 1)
    const chat: ChatMessage[] = chatJson.map(c => JSON.parse(c))

    return { room, members, chat }
  }

  /**
   * 加入房间
   */
  async joinRoom(code: string, userId?: string, guestId?: string, username?: string, riotId?: string): Promise<RoomState | null> {
    const state = await this.getRoomState(code)
    if (!state)
      return null

    const isGuest = !userId
    const odId = userId || guestId || randomUUID()

    // 检查是否已在房间
    const existingMember = state.members.find(m => m.odId === odId)
    if (existingMember) {
      return state // 已在房间，直接返回状态
    }

    // 检查房间是否已满
    if (state.members.length >= state.room.maxPlayers) {
      throw new Error('房间已满')
    }

    const member: RoomMember = {
      odId,
      isGuest,
      username: this.getDisplayName(odId, isGuest, username, riotId),
      riotId,
      joinedAt: Date.now(),
    }

    await this.redis.hset(RoomKeys.members(code), odId, JSON.stringify(member))

    // 更新房间状态
    const newMemberCount = state.members.length + 1
    if (newMemberCount >= state.room.maxPlayers) {
      state.room.status = 'full'
      await this.redis.set(RoomKeys.room(code), JSON.stringify(state.room))
    }

    state.members.push(member)

    // 通知其他订阅者
    this.broadcast(code, { type: 'member_join', data: member })

    this.logger.log(`${member.username} joined room ${code}`)

    return state
  }

  /**
   * 离开房间
   */
  async leaveRoom(code: string, odId: string): Promise<boolean> {
    const state = await this.getRoomState(code)
    if (!state)
      return false

    const member = state.members.find(m => m.odId === odId)
    if (!member)
      return false

    await this.redis.hdel(RoomKeys.members(code), odId)

    // 通知其他订阅者
    this.broadcast(code, { type: 'member_leave', data: { odId, username: member.username } })

    this.logger.log(`${member.username} left room ${code}`)

    // 检查房间是否为空
    const remainingMembers = await this.redis.hlen(RoomKeys.members(code))
    if (remainingMembers === 0) {
      await this.deleteRoom(code)
    }
    else {
      // 如果离开的是房主，转移房主
      if (state.room.ownerId === odId) {
        const membersHash = await this.redis.hgetall(RoomKeys.members(code))
        const firstMember: RoomMember = JSON.parse(Object.values(membersHash)[0])
        state.room.ownerId = firstMember.odId
        state.room.ownerIsGuest = firstMember.isGuest
        await this.redis.set(RoomKeys.room(code), JSON.stringify(state.room))
        this.logger.log(`Room ${code} owner transferred to ${firstMember.username}`)
        // 通知新房主
        this.broadcast(code, { type: 'owner_change', data: { newOwnerId: firstMember.odId } })
      }

      // 更新房间状态为 waiting（如果之前是 full）
      if (state.room.status === 'full') {
        state.room.status = 'waiting'
        await this.redis.set(RoomKeys.room(code), JSON.stringify(state.room))
      }
    }

    return true
  }

  /**
   * 踢出成员
   */
  async kickMember(code: string, ownerId: string, targetId: string): Promise<boolean> {
    const state = await this.getRoomState(code)
    if (!state)
      return false

    // 验证是否为房主
    if (state.room.ownerId !== ownerId) {
      throw new Error('只有房主可以踢人')
    }

    // 不能踢自己
    if (ownerId === targetId) {
      throw new Error('不能踢出自己')
    }

    return this.leaveRoom(code, targetId)
  }

  /**
   * 重置房间
   */
  async resetRoom(code: string, ownerId: string): Promise<RoomState | null> {
    const state = await this.getRoomState(code)
    if (!state)
      return null

    // 验证是否为房主
    if (state.room.ownerId !== ownerId) {
      throw new Error('只有房主可以重置房间')
    }

    // 获取房主信息
    const owner = state.members.find(m => m.odId === ownerId)
    if (!owner)
      return null

    // 清空其他成员
    for (const member of state.members) {
      if (member.odId !== ownerId) {
        await this.redis.hdel(RoomKeys.members(code), member.odId)
      }
    }

    // 清空聊天记录
    await this.redis.del(RoomKeys.chat(code))

    // 更新房间状态
    state.room.status = 'waiting'
    await this.redis.set(RoomKeys.room(code), JSON.stringify(state.room))

    // 通知订阅者房间已重置
    this.broadcast(code, { type: 'room_closed', data: { reason: 'reset' } })

    this.logger.log(`Room ${code} reset by ${owner.username}`)

    return {
      room: state.room,
      members: [owner],
      chat: [],
    }
  }

  /**
   * 发送聊天消息
   */
  async sendChat(code: string, odId: string, content: string): Promise<ChatMessage | null> {
    const state = await this.getRoomState(code)
    if (!state)
      return null

    const member = state.members.find(m => m.odId === odId)
    if (!member) {
      throw new Error('不在房间中')
    }

    const message: ChatMessage = {
      id: randomUUID(),
      odId,
      username: member.username,
      content,
      timestamp: Date.now(),
    }

    // 添加到聊天列表（保留最近100条）
    await this.redis.lpush(RoomKeys.chat(code), JSON.stringify(message))
    await this.redis.ltrim(RoomKeys.chat(code), 0, MAX_CHAT_MESSAGES - 1)

    // 通知订阅者
    this.broadcast(code, { type: 'chat', data: message })

    return message
  }

  /**
   * 删除房间
   */
  private async deleteRoom(code: string): Promise<void> {
    await this.redis.del(RoomKeys.room(code))
    await this.redis.del(RoomKeys.members(code))
    await this.redis.del(RoomKeys.chat(code))
    await this.redis.srem(RoomKeys.allRooms(), code)

    // 通知所有订阅者房间已关闭
    this.broadcast(code, { type: 'room_closed', data: { reason: 'empty' } })

    // 清理订阅者
    this.roomSubscribers.delete(code)

    this.logger.log(`Room ${code} deleted (empty)`)
  }

  /**
   * 获取所有房间列表（简要信息）
   */
  async listRooms(): Promise<Array<{ room: Room, memberCount: number }>> {
    const codes = await this.redis.smembers(RoomKeys.allRooms())
    const rooms: Array<{ room: Room, memberCount: number }> = []

    for (const code of codes) {
      const roomJson = await this.redis.get(RoomKeys.room(code))
      if (roomJson) {
        const room: Room = JSON.parse(roomJson)
        const memberCount = await this.redis.hlen(RoomKeys.members(code))
        rooms.push({ room, memberCount })
      }
      else {
        // 清理无效的房间码
        await this.redis.srem(RoomKeys.allRooms(), code)
      }
    }

    // 按创建时间倒序
    rooms.sort((a, b) => b.room.createdAt - a.room.createdAt)

    return rooms
  }

  /**
   * 查找用户当前所在的房间
   */
  async findUserRoom(odId: string): Promise<{ room: Room, memberCount: number } | null> {
    const codes = await this.redis.smembers(RoomKeys.allRooms())

    for (const code of codes) {
      const memberExists = await this.redis.hexists(RoomKeys.members(code), odId)
      if (memberExists) {
        const roomJson = await this.redis.get(RoomKeys.room(code))
        if (roomJson) {
          const room: Room = JSON.parse(roomJson)
          const memberCount = await this.redis.hlen(RoomKeys.members(code))
          return { room, memberCount }
        }
      }
    }

    return null
  }

  /**
   * 更新房间码
   */
  async updateRoomCode(oldCode: string, newCode: string, ownerId: string): Promise<RoomState | null> {
    const state = await this.getRoomState(oldCode)
    if (!state)
      return null

    // 验证是否为房主
    if (state.room.ownerId !== ownerId) {
      throw new Error('只有房主可以修改房间码')
    }

    // 检查新房间码是否已存在
    if (await this.redis.exists(RoomKeys.room(newCode))) {
      throw new Error('房间码已被使用')
    }

    // 更新房间码
    state.room.code = newCode

    // 迁移数据到新 key
    await this.redis.set(RoomKeys.room(newCode), JSON.stringify(state.room))
    await this.redis.del(RoomKeys.room(oldCode))

    // 迁移成员数据
    const membersHash = await this.redis.hgetall(RoomKeys.members(oldCode))
    if (Object.keys(membersHash).length > 0) {
      for (const [odId, memberJson] of Object.entries(membersHash)) {
        await this.redis.hset(RoomKeys.members(newCode), odId, memberJson)
      }
    }
    await this.redis.del(RoomKeys.members(oldCode))

    // 迁移聊天记录
    const chatMessages = await this.redis.lrange(RoomKeys.chat(oldCode), 0, -1)
    if (chatMessages.length > 0) {
      await this.redis.rpush(RoomKeys.chat(newCode), ...chatMessages)
    }
    await this.redis.del(RoomKeys.chat(oldCode))

    // 更新房间码集合
    await this.redis.srem(RoomKeys.allRooms(), oldCode)
    await this.redis.sadd(RoomKeys.allRooms(), newCode)

    // 迁移订阅者
    const subscribers = this.roomSubscribers.get(oldCode)
    if (subscribers) {
      this.roomSubscribers.set(newCode, subscribers)
      this.roomSubscribers.delete(oldCode)
    }

    this.logger.log(`Room code changed: ${oldCode} -> ${newCode}`)

    return state
  }

  /**
   * 更新房间设置（房间码和/或段位限制）
   */
  async updateRoomSettings(code: string, ownerId: string, settings: UpdateRoomSettingsDto): Promise<RoomState | null> {
    const state = await this.getRoomState(code)
    if (!state)
      return null

    // 验证是否为房主
    if (state.room.ownerId !== ownerId) {
      throw new Error('只有房主可以修改房间设置')
    }

    let newCode = code

    // 更新房间码
    if (settings.newCode && settings.newCode !== code) {
      // 检查新房间码是否已存在
      if (await this.redis.exists(RoomKeys.room(settings.newCode))) {
        throw new Error('房间码已被使用')
      }

      newCode = settings.newCode
      state.room.code = newCode

      // 迁移数据到新 key
      await this.redis.set(RoomKeys.room(newCode), JSON.stringify(state.room))
      await this.redis.del(RoomKeys.room(code))

      // 迁移成员数据
      const membersHash = await this.redis.hgetall(RoomKeys.members(code))
      if (Object.keys(membersHash).length > 0) {
        for (const [odId, memberJson] of Object.entries(membersHash)) {
          await this.redis.hset(RoomKeys.members(newCode), odId, memberJson)
        }
      }
      await this.redis.del(RoomKeys.members(code))

      // 迁移聊天记录
      const chatMessages = await this.redis.lrange(RoomKeys.chat(code), 0, -1)
      if (chatMessages.length > 0) {
        await this.redis.rpush(RoomKeys.chat(newCode), ...chatMessages)
      }
      await this.redis.del(RoomKeys.chat(code))

      // 更新房间码集合
      await this.redis.srem(RoomKeys.allRooms(), code)
      await this.redis.sadd(RoomKeys.allRooms(), newCode)

      // 迁移订阅者
      const subscribers = this.roomSubscribers.get(code)
      if (subscribers) {
        this.roomSubscribers.set(newCode, subscribers)
        this.roomSubscribers.delete(code)
      }

      this.logger.log(`Room code changed: ${code} -> ${newCode}`)
    }

    // 更新段位限制
    if (settings.rankTiers !== undefined) {
      // 空数组表示清除段位限制
      state.room.rankTiers = settings.rankTiers.length > 0 ? settings.rankTiers as RankTier[] : undefined
      await this.redis.set(RoomKeys.room(newCode), JSON.stringify(state.room))
      this.logger.log(`Room ${newCode} rank tiers updated: ${settings.rankTiers.join(', ') || 'any'}`)
    }

    return state
  }

  /**
   * 订阅房间事件 (SSE)
   */
  subscribe(code: string): Subject<RoomEvent> {
    const subject = new Subject<RoomEvent>()

    if (!this.roomSubscribers.has(code)) {
      this.roomSubscribers.set(code, new Set())
    }
    this.roomSubscribers.get(code)!.add(subject)

    // 当客户端断开连接时清理
    subject.subscribe({
      complete: () => {
        const subscribers = this.roomSubscribers.get(code)
        if (subscribers) {
          subscribers.delete(subject)
          if (subscribers.size === 0) {
            this.roomSubscribers.delete(code)
          }
        }
      },
    })

    return subject
  }

  /**
   * 广播事件到房间所有订阅者
   */
  private broadcast(code: string, event: RoomEvent): void {
    const subscribers = this.roomSubscribers.get(code)
    if (subscribers) {
      for (const subject of subscribers) {
        subject.next(event)
      }
    }
  }
}
