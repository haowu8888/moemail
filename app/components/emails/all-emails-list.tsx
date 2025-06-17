"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Mail, RefreshCw, Trash2, User, Eye, Trash } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useThrottle } from "@/hooks/use-throttle"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AllEmail {
  id: string
  address: string
  userId: string | null
  createdAt: Date
  expiresAt: Date
  userName?: string | null
  userEmail?: string | null
}

interface AllEmailsListProps {
  onEmailSelect: (email: AllEmail | null) => void
  selectedEmailId?: string
  onViewAll?: () => void
  timeFilter?: string
  onTimeFilterChange?: (filter: string) => void
}

interface AllEmailsResponse {
  emails: AllEmail[]
  nextCursor: string | null
  total: number
}

export function AllEmailsList({ onEmailSelect, selectedEmailId, onViewAll, timeFilter: propTimeFilter, onTimeFilterChange }: AllEmailsListProps) {
  const { data: session } = useSession()
  const [emails, setEmails] = useState<AllEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [emailToDelete, setEmailToDelete] = useState<AllEmail | null>(null)
  const [timeFilter, setTimeFilter] = useState<string>(propTimeFilter || '60')
  const [clearing, setClearing] = useState(false)
  const { toast } = useToast()

  const fetchEmails = async (cursor?: string) => {
    try {
      const url = new URL("/api/admin/emails", window.location.origin)
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
            description: "您没有权限查看所有邮箱",
            variant: "destructive"
          })
          return
        }
        throw new Error('Failed to fetch emails')
      }
      
      const data = await response.json() as AllEmailsResponse
      
      if (!cursor) {
        const newEmails = data.emails
        const oldEmails = emails

        const lastDuplicateIndex = newEmails.findIndex(
          newEmail => oldEmails.some(oldEmail => oldEmail.id === newEmail.id)
        )

        if (lastDuplicateIndex === -1) {
          setEmails(newEmails)
          setNextCursor(data.nextCursor)
          setTotal(data.total)
          return
        }
        const uniqueNewEmails = newEmails.slice(0, lastDuplicateIndex)
        setEmails([...uniqueNewEmails, ...oldEmails])
        setTotal(data.total)
        return
      }
      setEmails(prev => [...prev, ...data.emails])
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch all emails:", error)
      toast({
        title: "错误",
        description: "获取邮箱列表失败",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchEmails()
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchEmails(nextCursor)
    }
  }, 200)

  useEffect(() => {
    if (session) fetchEmails()
  }, [session, timeFilter])

  const handleDelete = async (email: AllEmail) => {
    if (email.userId) {
      toast({
        title: "权限不足",
        description: "无法删除用户创建的邮箱，请让用户自行删除",
        variant: "destructive"
      })
      setEmailToDelete(null)
      return
    }

    try {
      const response = await fetch(`/api/admin/emails/${email.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        toast({
          title: "错误",
          description: (data as { error: string }).error,
          variant: "destructive"
        })
        return
      }

      setEmails(prev => prev.filter(e => e.id !== email.id))
      setTotal(prev => prev - 1)

      toast({
        title: "成功",
        description: "系统邮箱已删除"
      })
      
      if (selectedEmailId === email.id) {
        onEmailSelect(null)
      }
    } catch {
      toast({
        title: "错误",
        description: "删除邮箱失败",
        variant: "destructive"
      })
    } finally {
      setEmailToDelete(null)
    }
  }

  const handleClearTemporary = async () => {
    setClearing(true)
    try {
      const response = await fetch('/api/admin/emails/clear-temporary', {
        method: 'POST'
      })
      
      if (!response.ok) {
        const data = await response.json()
        toast({
          title: "错误",
          description: (data as { error: string }).error,
          variant: "destructive"
        })
        return
      }
      
      const result = await response.json() as { deletedCount: number }
      toast({
        title: "成功",
        description: `已清空 ${result.deletedCount} 个临时邮箱`
      })
      
      await fetchEmails()
      onEmailSelect(null)
    } catch {
      toast({
        title: "错误",
        description: "清空临时邮箱失败",
        variant: "destructive"
      })
    } finally {
      setClearing(false)
    }
  }

  if (!session) return null

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-2 border-b border-primary/20 space-y-2">
          <div className="flex items-center gap-2">
            <Select value={timeFilter} onValueChange={(value) => {
              setTimeFilter(value)
              onTimeFilterChange?.(value)
            }}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10分钟</SelectItem>
                <SelectItem value="60">60分钟</SelectItem>
                <SelectItem value="2880">2天</SelectItem>
                <SelectItem value="10080">7天</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-500 flex-1">
              共 {total} 个邮箱
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAll}
              className="h-6 px-2 text-xs"
            >
              <Eye className="w-3 h-3 mr-1" />
              查看所有
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearTemporary}
              disabled={clearing}
              className="h-6 px-2 text-xs text-destructive"
            >
              <Trash className="w-3 h-3 mr-1" />
              {clearing ? '清空中...' : '清空'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn("h-6 px-2 text-xs", refreshing && "animate-spin")}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              刷新
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-2" onScroll={handleScroll}>
          {loading ? (
            <div className="text-center text-sm text-gray-500">加载中...</div>
          ) : emails.length > 0 ? (
            <div className="space-y-1">
              {emails.map(email => (
                <div
                  key={email.id}
                  className={cn("flex items-center gap-2 p-2 rounded cursor-pointer text-sm group",
                    "hover:bg-primary/5",
                    selectedEmailId === email.id && "bg-primary/10"
                  )}
                  onClick={() => onEmailSelect(email)}
                >
                  <Mail className="h-4 w-4 text-primary/60" />
                  <div className="truncate flex-1">
                    <div className="font-medium truncate">{email.address}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="truncate">
                        {email.userId ? (email.userName || email.userEmail || '已注册用户') : '系统邮箱'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(email.expiresAt).getFullYear() === 9999 ? (
                        "永久有效"
                      ) : (
                        `过期时间: ${new Date(email.expiresAt).toLocaleString()}`
                      )}
                    </div>
                  </div>
                  {!email.userId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEmailToDelete(email)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
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
              暂无邮箱
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!emailToDelete} onOpenChange={() => setEmailToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除邮箱 {emailToDelete?.address} 吗？此操作将同时删除该邮箱中的所有邮件，且不可恢复。
              <br />
              <span className="text-sm text-gray-500">
                {emailToDelete?.userId ? 
                  `所属用户: ${emailToDelete?.userName || emailToDelete?.userEmail || '已注册用户'}` :
                  '系统临时邮箱'
                }
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => emailToDelete && handleDelete(emailToDelete)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}