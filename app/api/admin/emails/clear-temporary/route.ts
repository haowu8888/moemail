import { createDb } from "@/lib/db"
import { isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { emails } from "@/lib/schema"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"

export const runtime = "edge"

export async function POST() {
  // 检查用户权限
  const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)
  if (!hasPermission) {
    return NextResponse.json(
      { error: "没有权限访问此资源" },
      { status: 403 }
    )
  }

  const db = createDb()

  try {
    // 查找所有系统邮箱（userId为null）
    const systemEmails = await db.query.emails.findMany({
      where: isNull(emails.userId)
    })

    if (systemEmails.length === 0) {
      return NextResponse.json({ deletedCount: 0 })
    }

    // 删除系统邮箱（数据库外键约束会自动删除相关邮件）
    await db.delete(emails).where(isNull(emails.userId))

    return NextResponse.json({ 
      deletedCount: systemEmails.length,
      message: `成功清空 ${systemEmails.length} 个临时邮箱`
    })
  } catch (error) {
    console.error('Failed to clear temporary emails:', error)
    return NextResponse.json(
      { error: "清空临时邮箱失败" },
      { status: 500 }
    )
  }
}