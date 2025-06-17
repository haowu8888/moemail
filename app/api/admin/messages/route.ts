import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { emails, messages, users } from "@/lib/schema"
import { eq, and, lt, or, sql, gt } from "drizzle-orm"
import { encodeCursor, decodeCursor } from "@/lib/cursor"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"

export const runtime = "edge"

const PAGE_SIZE = 20

export async function GET(request: Request) {
  // 检查用户权限
  const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)
  if (!hasPermission) {
    return NextResponse.json(
      { error: "没有权限访问此资源" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const timeFilter = searchParams.get('timeFilter') // 时间筛选（分钟）
  
  const db = createDb()

  try {
    // 基础条件：只显示未过期的邮箱的消息
    let baseEmailConditions = gt(emails.expiresAt, new Date())
    
    // 添加时间筛选到邮箱
    if (timeFilter) {
      const minutes = parseInt(timeFilter)
      const timeThreshold = new Date(Date.now() - minutes * 60 * 1000)
      const timeCondition = gt(emails.createdAt, timeThreshold)
      baseEmailConditions = and(baseEmailConditions, timeCondition) as any
    }

    // 获取符合条件的邮箱ID
    const validEmails = await db.select({ id: emails.id })
      .from(emails)
      .where(baseEmailConditions)

    if (validEmails.length === 0) {
      return NextResponse.json({ 
        messages: [],
        nextCursor: null,
        total: 0
      })
    }

    const emailIds = validEmails.map(e => e.id)

    // 计算总数
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(sql`${messages.emailId} IN (${sql.join(emailIds.map(id => sql`${id}`), sql`, `)})`)
    const totalCount = Number(totalResult[0].count)

    const conditions = [sql`${messages.emailId} IN (${sql.join(emailIds.map(id => sql`${id}`), sql`, `)})`]

    if (cursor) {
      const { timestamp, id } = decodeCursor(cursor)
      const cursorCondition = or(
        lt(messages.receivedAt, new Date(timestamp)),
        and(
          eq(messages.receivedAt, new Date(timestamp)),
          lt(messages.id, id)
        )
      )
      if (cursorCondition) {
        conditions.push(cursorCondition)
      }
    }

    // 查询消息，包含邮箱和用户信息
    const results = await db.select({
      id: messages.id,
      fromAddress: messages.fromAddress,
      subject: messages.subject,
      receivedAt: messages.receivedAt,
      emailId: messages.emailId,
      emailAddress: emails.address,
      emailUserId: emails.userId,
      userName: users.name,
      userEmail: users.email,
    })
      .from(messages)
      .leftJoin(emails, eq(messages.emailId, emails.id))
      .leftJoin(users, eq(emails.userId, users.id))
      .where(and(...conditions))
      .orderBy(sql`${messages.receivedAt} DESC, ${messages.id} DESC`)
      .limit(PAGE_SIZE + 1)
    
    const hasMore = results.length > PAGE_SIZE
    const nextCursor = hasMore 
      ? encodeCursor(
          results[PAGE_SIZE - 1].receivedAt.getTime(),
          results[PAGE_SIZE - 1].id
        )
      : null
    const messageList = hasMore ? results.slice(0, PAGE_SIZE) : results

    return NextResponse.json({ 
      messages: messageList.map(msg => ({
        id: msg.id,
        from_address: msg.fromAddress,
        subject: msg.subject,
        received_at: msg.receivedAt.getTime(),
        email_id: msg.emailId,
        email_address: msg.emailAddress,
        email_user_id: msg.emailUserId,
        user_name: msg.userName,
        user_email: msg.userEmail,
      })),
      nextCursor,
      total: totalCount
    })
  } catch (error) {
    console.error('Failed to fetch all messages:', error)
    return NextResponse.json(
      { error: "获取消息列表失败" },
      { status: 500 }
    )
  }
}