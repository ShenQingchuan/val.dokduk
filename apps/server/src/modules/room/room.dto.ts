import { z } from 'zod'

// Room types
export type GameMode = '2v2' | '3v3' | '5v5'
export type RoomStatus = 'waiting' | 'full'

// Valorant rank tiers (0-8, where 0 is Iron and 8 is Radiant)
export const RANK_TIERS = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'ascendant',
  'immortal',
  'radiant',
] as const

export type RankTier = typeof RANK_TIERS[number]

export interface Room {
  id: string
  code: string
  ownerId: string // 游客UUID 或 用户ID
  ownerIsGuest: boolean
  gameMode: GameMode
  maxPlayers: number
  status: RoomStatus
  rankTiers?: RankTier[] // 允许的段位（可多选）
  createdAt: number
}

export interface RoomMember {
  odId: string // 游客UUID 或 用户ID
  isGuest: boolean
  username: string // 显示名：游客_XXXX 或 用户名
  riotId?: string // 绑定的 玩家名#tag
  joinedAt: number
}

export interface ChatMessage {
  id: string
  odId: string
  username: string
  content: string
  timestamp: number
}

export interface RoomState {
  room: Room
  members: RoomMember[]
  chat: ChatMessage[]
}

// Validation schemas
export const CreateRoomSchema = z.object({
  roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/), // 房间码（6位大写字母+数字）
  gameMode: z.enum(['2v2', '3v3', '5v5']),
  rankTiers: z.array(z.enum(RANK_TIERS)).min(1).optional(), // 允许的段位（可多选）
  guestId: z.string().uuid().optional(), // 游客UUID
})

export const JoinRoomSchema = z.object({
  guestId: z.string().uuid().optional(), // 游客UUID
})

export const SendChatSchema = z.object({
  content: z.string().min(1).max(500),
  guestId: z.string().uuid().optional(), // 游客UUID
})

export const KickMemberSchema = z.object({
  targetId: z.string(), // 要踢的成员ID
})

export const LeaveRoomSchema = z.object({
  guestId: z.string().uuid().optional(), // 游客UUID
})

export const UpdateRoomCodeSchema = z.object({
  newCode: z.string().length(6).regex(/^[A-Z0-9]+$/), // 新房间码
})

export const UpdateRoomSettingsSchema = z.object({
  newCode: z.string().length(6).regex(/^[A-Z0-9]+$/).optional(), // 新房间码（可选）
  rankTiers: z.array(z.enum(RANK_TIERS)).optional(), // 允许的段位（可选，空数组表示清除限制）
})

export type CreateRoomDto = z.infer<typeof CreateRoomSchema>
export type JoinRoomDto = z.infer<typeof JoinRoomSchema>
export type SendChatDto = z.infer<typeof SendChatSchema>
export type KickMemberDto = z.infer<typeof KickMemberSchema>
export type LeaveRoomDto = z.infer<typeof LeaveRoomSchema>
export type UpdateRoomCodeDto = z.infer<typeof UpdateRoomCodeSchema>
export type UpdateRoomSettingsDto = z.infer<typeof UpdateRoomSettingsSchema>
