import { createDb } from "@/lib/db"
import { and, eq, gt, lt, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { emails, users } from "@/lib/schema"
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
    let baseConditions = gt(emails.expiresAt, new Date())
    
    // 添加时间筛选
    if (timeFilter) {
      const minutes = parseInt(timeFilter)
      const timeThreshold = new Date(Date.now() - minutes * 60 * 1000)
      const timeCondition = gt(emails.createdAt, timeThreshold)
      baseConditions = and(baseConditions, timeCondition) as any
    }

    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(baseConditions)
    const totalCount = Number(totalResult[0].count)

    const conditions = [baseConditions]

    if (cursor) {
      const { timestamp, id } = decodeCursor(cursor)
      const cursorCondition = or(
        lt(emails.createdAt, new Date(timestamp)),
        and(
          eq(emails.createdAt, new Date(timestamp)),
          lt(emails.id, id)
        )
      )
      if (cursorCondition) {
        conditions.push(cursorCondition)
      }
    }

    const results = await db.select({
      id: emails.id,
      address: emails.address,
      userId: emails.userId,
      createdAt: emails.createdAt,
      expiresAt: emails.expiresAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(emails)
      .leftJoin(users, eq(emails.userId, users.id))
      .where(and(...conditions))
      .orderBy(sql`${emails.createdAt} DESC, ${emails.id} DESC`)
      .limit(PAGE_SIZE + 1)
    
    const hasMore = results.length > PAGE_SIZE
    const nextCursor = hasMore 
      ? encodeCursor(
          results[PAGE_SIZE - 1].createdAt.getTime(),
          results[PAGE_SIZE - 1].id
        )
      : null
    const emailList = hasMore ? results.slice(0, PAGE_SIZE) : results

    return NextResponse.json({ 
      emails: emailList,
      nextCursor,
      total: totalCount
    })
  } catch (error) {
    console.error('Failed to fetch all emails:', error)
    return NextResponse.json(
      { error: "获取邮箱列表失败" },
      { status: 500 }
    )
  }
}