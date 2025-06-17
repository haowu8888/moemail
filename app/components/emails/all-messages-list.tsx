"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { useThrottle } from "@/hooks/use-throttle"
import { useToast } from "@/components/ui/use-toast"

interface AllMessage {
  id: string
  from_address: string
  subject: string
  received_at: number
  email_id: string
  email_address: string
  email_user_id: string | null
  user_name?: string | null
  user_email?: string | null
}

interface AllMessagesListProps {
  onMessageSelect: (emailId: string, messageId: string) => void
  selectedMessageId?: string | null
  timeFilter?: string
}

interface AllMessagesResponse {
  messages: AllMessage[]
  nextCursor: string | null
  total: number
}

export function AllMessagesList({ onMessageSelect, selectedMessageId, timeFilter }: AllMessagesListProps) {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<AllMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const { toast } = useToast()

  const fetchMessages = async (cursor?: string, reset = false) => {
    try {
      const url = new URL("/api/admin/messages", window.location.origin)
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }
      if (timeFilter) {
        url.searchParams.set('timeFilter', timeFilter)
      }
      const response = await fetch(url)
      
      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "权限不足",
            description: "您没有权限查看所有消息",
            variant: "destructive"
          })
          return
        }
        throw new Error('Failed to fetch messages')
      }
      
      const data = await response.json() as AllMessagesResponse
      
      if (reset || !cursor) {
        setMessages(data.messages)
      } else {
        setMessages(prev => [...prev, ...data.messages])
      }
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch all messages:", error)
      toast({
        title: "错误",
        description: "获取消息列表失败",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchMessages(nextCursor)
    }
  }, 200)

  useEffect(() => {
    if (session) {
      setLoading(true)
      fetchMessages(undefined, true)
    }
  }, [session, timeFilter])

  if (!session) return null

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return "刚刚"
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-primary/20">
        <div className="text-xs text-gray-500">
          共 {total} 条消息
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2" onScroll={handleScroll}>
        {loading ? (
          <div className="text-center text-sm text-gray-500">加载中...</div>
        ) : messages.length > 0 ? (
          <div className="space-y-1">
            {messages.map(message => (
              <div
                key={message.id}
                className={cn("flex flex-col gap-2 p-3 rounded cursor-pointer text-sm group border",
                  "hover:bg-primary/5 hover:border-primary/20",
                  selectedMessageId === message.id && "bg-primary/10 border-primary/30"
                )}
                onClick={() => onMessageSelect(message.email_id, message.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Mail className="h-4 w-4 text-primary/60 shrink-0" />
                    <div className="truncate">
                      <span className="font-medium">{message.subject || "无主题"}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0">
                    {formatDate(message.received_at)}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex items-center gap-2">
                    <span>发件人:</span>
                    <span className="font-medium truncate">{message.from_address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>接收邮箱:</span>
                    <span className="font-medium">{message.email_address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>邮箱所有者:</span>
                    <span className="font-medium">
                      {message.email_user_id ? 
                        (message.user_name || message.user_email || '已注册用户') : 
                        '系统邮箱'
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="text-center text-sm text-gray-500 py-2">
                加载更多...
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500">
            暂无消息
          </div>
        )}
      </div>
    </div>
  )
}