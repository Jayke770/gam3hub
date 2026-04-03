import { create } from 'zustand'

export interface Message {
  id: string
  user: string
  message: string
  dateTime: string
}

interface MessageState {
  messages: Message[]
  addMessage: (message: Omit<Message, 'id' | 'dateTime'> & { dateTime?: string }) => void
  setMessages: (messages: Message[]) => void
  clearMessages: () => void
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, {
      id: Math.random().toString(36).substring(7),
      user: msg.user,
      message: msg.message,
      dateTime: msg.dateTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]
  })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
}))
