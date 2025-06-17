import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { messages, emails } from "@/lib/schema"
import { and, eq } from "drizzle-orm"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"

export const runtime = "edge"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
    // 检查用户权限
    const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)
    if (!hasPermission) {
        return NextResponse.json(
            { error: "没有权限访问此资源" },
            { status: 403 }
        )
    }

    try {
        const { id, messageId } = await params
        const db = createDb()

        // 管理员可以查看任何邮件，不需要检查userId
        const email = await db.query.emails.findFirst({
            where: eq(emails.id, id)
        })

        if (!email) {
            return NextResponse.json(
                { error: "邮箱不存在" },
                { status: 404 }
            )
        }

        const message = await db.query.messages.findFirst({
            where: and(
                eq(messages.id, messageId),
                eq(messages.emailId, id)
            )
        })

        if (!message) {
            return NextResponse.json(
                { error: "消息不存在" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            message: {
                id: message.id,
                from_address: message.fromAddress,
                subject: message.subject,
                content: message.content,
                html: message.html,
                received_at: message.receivedAt.getTime()
            }
        })
    } catch (error) {
        console.error('Failed to fetch message:', error)
        return NextResponse.json(
            { error: "获取消息失败" },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; messageId: string }> }
) {
    // 检查用户权限
    const hasPermission = await checkPermission(PERMISSIONS.MANAGE_EMAIL)
    if (!hasPermission) {
        return NextResponse.json(
            { error: "没有权限访问此资源" },
            { status: 403 }
        )
    }

    try {
        const db = createDb()
        const { id, messageId } = await params

        // 管理员可以删除任何邮件，不需要检查userId
        const email = await db.query.emails.findFirst({
            where: eq(emails.id, id)
        })

        if (!email) {
            return NextResponse.json(
                { error: "邮箱不存在" },
                { status: 404 }
            )
        }

        const message = await db.query.messages.findFirst({
            where: and(
                eq(messages.emailId, id),
                eq(messages.id, messageId)
            )
        })

        if (!message) {
            return NextResponse.json(
                { error: "消息不存在或已删除" },
                { status: 404 }
            )
        }

        await db.delete(messages)
            .where(eq(messages.id, messageId))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete message:', error)
        return NextResponse.json(
            { error: "删除消息失败" },
            { status: 500 }
        )
    }
}