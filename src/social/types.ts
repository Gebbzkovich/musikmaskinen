export interface Profile { id: string; handle: string | null; displayName: string | null }
export interface Conversation { id: string; other: Profile; lastAt: string | null; lastPreview: string | null }
export interface Message { id: string; conversationId: string; senderId: string; kind: 'text' | 'track'; body: string | null; trackId: string | null; createdAt: string }
export type { Track } from '../lib/types'
