import { createDb } from "@/lib/db"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { emails } from "@/lib/schema"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"

export const runtime = "edge"

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 检查用户权限
  const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)
  if (!hasPermission) {
    return NextResponse.json(
      { error: "没有权限访问此资源" },
      { status: 403 }
    )
  }

  const db = createDb()
  const params = await context.params
  const emailId = params.id

  try {
    // 查找邮箱并确认是系统邮箱
    const email = await db.query.emails.findFirst({
      where: eq(emails.id, emailId)
    })

    if (!email) {
      return NextResponse.json(
        { error: "邮箱不存在" },
        { status: 404 }
      )
    }

    // 只允许删除系统邮箱（userId为null）
    if (email.userId !== null) {
      return NextResponse.json(
        { error: "无法删除用户创建的邮箱" },
        { status: 403 }
      )
    }

    // 删除邮箱及其相关邮件（数据库外键约束会自动删除相关邮件）
    await db.delete(emails).where(eq(emails.id, emailId))

    return NextResponse.json({ 
      message: "邮箱已删除",
      emailId: emailId
    })
  } catch (error) {
    console.error('Failed to delete email:', error)
    return NextResponse.json(
      { error: "删除邮箱失败" },
      { status: 500 }
    )
  }
}