'use client'

import { Suspense } from 'react'
import { ChatContent } from '@/components/chat/chat-content'

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  )
}
