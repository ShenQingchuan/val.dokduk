import { apiClient } from './client'

// Types
export type GameMode = '2v2' | '3v3' | '5v5'
export type RoomStatus = 'waiting' | 'full'

// Valorant rank tiers
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
  ownerId: string
  ownerIsGuest: boolean
  gameMode: GameMode
  maxPlayers: number
  status: RoomStatus
  rankTiers?: RankTier[]
  createdAt: number
}

export interface RoomMember {
  odId: string
  isGuest: boolean
  username: string
  riotId?: string
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

// SSE Event types
export type RoomEventType = 'state' | 'member_join' | 'member_leave' | 'chat' | 'room_closed' | 'owner_change'

export interface RoomEvent {
  type: RoomEventType
  data: unknown
}

export interface MemberJoinEvent {
  type: 'member_join'
  data: RoomMember
}

export interface MemberLeaveEvent {
  type: 'member_leave'
  data: { odId: string, username: string }
}

export interface ChatEvent {
  type: 'chat'
  data: ChatMessage
}

export interface RoomClosedEvent {
  type: 'room_closed'
  data: { reason: 'empty' | 'reset' }
}

// Guest ID management
const GUEST_ID_KEY = 'room_guest_id'

export function getGuestId(): string {
  let guestId = localStorage.getItem(GUEST_ID_KEY)
  if (!guestId) {
    guestId = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, guestId)
  }
  return guestId
}

// Room list item
export interface RoomListItem {
  room: Room
  memberCount: number
}

// API methods
export const roomApi = {
  /**
   * 获取所有房间列表
   */
  async listRooms(): Promise<RoomListItem[]> {
    const response = await apiClient.get<{ data: RoomListItem[] }>('/api/rooms')
    return response.data
  },

  /**
   * 获取当前用户所在的房间
   */
  async getMyRoom(): Promise<RoomListItem | null> {
    const guestId = getGuestId()
    const response = await apiClient.get<{ data: RoomListItem | null }>(`/api/rooms/my?guestId=${guestId}`)
    return response.data
  },

  /**
   * 创建房间
   */
  async createRoom(roomCode: string, gameMode: GameMode, rankTiers?: RankTier[]): Promise<RoomState> {
    const guestId = getGuestId()
    const response = await apiClient.post<{ data: RoomState }>('/api/rooms', {
      roomCode,
      gameMode,
      rankTiers,
      guestId,
    })
    return response.data
  },

  /**
   * 获取房间状态
   */
  async getRoomState(code: string): Promise<RoomState> {
    const response = await apiClient.get<{ data: RoomState }>(`/api/rooms/${code}`)
    return response.data
  },

  /**
   * 加入房间
   */
  async joinRoom(code: string): Promise<RoomState> {
    const guestId = getGuestId()
    const response = await apiClient.post<{ data: RoomState }>(`/api/rooms/${code}/join`, {
      guestId,
    })
    return response.data
  },

  /**
   * 离开房间
   */
  async leaveRoom(code: string): Promise<void> {
    const guestId = getGuestId()
    await apiClient.post(`/api/rooms/${code}/leave`, {
      guestId,
    })
  },

  /**
   * 踢出成员
   */
  async kickMember(code: string, targetId: string): Promise<void> {
    const guestId = getGuestId()
    await apiClient.post(`/api/rooms/${code}/kick`, {
      guestId,
      targetId,
    })
  },

  /**
   * 重置房间
   */
  async resetRoom(code: string): Promise<RoomState> {
    const guestId = getGuestId()
    const response = await apiClient.post<{ data: RoomState }>(`/api/rooms/${code}/reset`, {
      guestId,
    })
    return response.data
  },

  /**
   * 发送聊天消息
   */
  async sendChat(code: string, content: string): Promise<ChatMessage> {
    const guestId = getGuestId()
    const response = await apiClient.post<{ data: ChatMessage }>(`/api/rooms/${code}/chat`, {
      guestId,
      content,
    })
    return response.data
  },

  /**
   * 更新房间码
   */
  async updateRoomCode(code: string, newCode: string): Promise<RoomState> {
    const guestId = getGuestId()
    const response = await apiClient.post<{ data: RoomState }>(`/api/rooms/${code}/update-code`, {
      guestId,
      newCode,
    })
    return response.data
  },

  /**
   * 更新房间设置（房间码和段位限制）
   */
  async updateRoomSettings(code: string, settings: { newCode?: string, rankTiers?: RankTier[] }): Promise<RoomState> {
    const guestId = getGuestId()
    const response = await apiClient.post<{ data: RoomState }>(`/api/rooms/${code}/settings`, {
      guestId,
      ...settings,
    })
    return response.data
  },

  /**
   * 订阅房间事件 (SSE)
   */
  subscribeEvents(code: string, onEvent: (event: RoomEvent) => void, onError?: (error: Event) => void): () => void {
    const API_BASE_URL = import.meta.env.VITE_API_URL || ''
    const eventSource = new EventSource(`${API_BASE_URL}/api/rooms/${code}/events`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RoomEvent
        onEvent(data)
      }
      catch (e) {
        console.error('Failed to parse SSE event:', e)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      onError?.(error)
    }

    // 返回取消订阅函数
    return () => {
      eventSource.close()
    }
  },
}
