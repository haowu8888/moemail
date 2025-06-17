import { Env } from '../types'
import { drizzle } from 'drizzle-orm/d1'
import { messages, emails, webhooks } from '../app/lib/schema'
import { eq, sql } from 'drizzle-orm'
import PostalMime from 'postal-mime'
import { WEBHOOK_CONFIG } from '../app/config/webhook'
import { EmailMessage } from '../app/lib/webhook'

const handleEmail = async (message: ForwardableEmailMessage, env: Env) => {
  const db = drizzle(env.DB, { schema: { messages, emails, webhooks } })

  const parsedMessage = await PostalMime.parse(message.raw)

  console.log("parsedMessage:", parsedMessage)

  try {
    // 查找已存在的邮箱
    let targetEmail = await db.query.emails.findFirst({
      where: eq(sql`LOWER(${emails.address})`, message.to.toLowerCase())
    })

    // 如果邮箱不存在，自动创建一个系统邮箱（不绑定用户）
    if (!targetEmail) {
      console.log(`Email not found, creating system email: ${message.to}`)
      
      // 设置过期时间为30天后
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      
      targetEmail = await db.insert(emails).values({
        address: message.to.toLowerCase(),
        userId: null, // 系统邮箱不绑定用户
        expiresAt: expiresAt,
      }).returning().get()
      
      console.log(`Created system email: ${targetEmail.address} (ID: ${targetEmail.id})`)
    }

    const savedMessage = await db.insert(messages).values({
      emailId: targetEmail.id,
      fromAddress: message.from,
      subject: parsedMessage.subject || '(无主题)',
      content: parsedMessage.text || '',
      html: parsedMessage.html || '',
    }).returning().get()

    const webhook = await db.query.webhooks.findFirst({
      where: eq(webhooks.userId, targetEmail!.userId!)
    })

    if (webhook?.enabled) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': WEBHOOK_CONFIG.EVENTS.NEW_MESSAGE
          },
          body: JSON.stringify({
            emailId: targetEmail.id,
            messageId: savedMessage.id,
            fromAddress: savedMessage.fromAddress,
            subject: savedMessage.subject,
            content: savedMessage.content,
            html: savedMessage.html,
            receivedAt: savedMessage.receivedAt.toISOString(),
            toAddress: targetEmail.address
          } as EmailMessage)
        })
      } catch (error) {
        console.error('Failed to send webhook:', error)
      }
    }

    console.log(`Email processed: ${parsedMessage.subject}`)
  } catch (error) {
    console.error('Failed to process email:', error)
  }
}

const worker = {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env)
  }
}

export default worker 