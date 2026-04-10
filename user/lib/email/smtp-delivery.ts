import nodemailer from 'nodemailer'
import {
  buildOrderDeliveryEmail,
  type OrderDeliveryEmailPayload,
} from './order-delivery-template'

export type DeliveryEmailSendResult = {
  ok: boolean
  attempts: number
  error?: string
  messageId?: string
  nonRetryable?: boolean
}

export function normalizeCustomerEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

export function isValidCustomerEmail(email: string) {
  const normalized = normalizeCustomerEmail(email)
  // Basic but strict enough for transactional customer emails.
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes' || v === 'on'
}

function parseInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveFromAddress() {
  const fromEmail = String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '').trim()
  const fromName = String(process.env.SMTP_FROM_NAME || 'Putra BTT Store').trim()

  if (!fromEmail) {
    return { ok: false as const, error: 'smtp_from_email_missing' }
  }

  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  return { ok: true as const, from }
}

function createSmtpTransport() {
  const smtpUrl = String(process.env.SMTP_URL || '').trim()

  if (smtpUrl) {
    return {
      ok: true as const,
      transporter: nodemailer.createTransport(smtpUrl),
    }
  }

  const host = String(process.env.SMTP_HOST || '').trim()
  const port = parseInteger(process.env.SMTP_PORT, 0)
  const user = String(process.env.SMTP_USER || '').trim()
  const rawPass = String(process.env.SMTP_PASS || '').trim()
  const pass = rawPass.includes(' ') ? rawPass.replace(/\s+/g, '') : rawPass

  if (!host || !port) {
    return { ok: false as const, error: 'smtp_host_or_port_missing' }
  }

  if ((user && !pass) || (!user && pass)) {
    return { ok: false as const, error: 'smtp_user_pass_incomplete' }
  }

  const secure = parseBoolean(process.env.SMTP_SECURE, port === 465)

  return {
    ok: true as const,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    }),
  }
}

async function sendOrderDeliveryEmailOnce(payload: OrderDeliveryEmailPayload): Promise<DeliveryEmailSendResult> {
  const normalizedEmail = normalizeCustomerEmail(payload.customerEmail)
  if (!isValidCustomerEmail(normalizedEmail)) {
    return {
      ok: false,
      attempts: 1,
      error: 'invalid_customer_email',
      nonRetryable: true,
    }
  }

  const fromAddress = resolveFromAddress()
  if (!fromAddress.ok) {
    return {
      ok: false,
      attempts: 1,
      error: fromAddress.error,
      nonRetryable: true,
    }
  }

  const smtp = createSmtpTransport()
  if (!smtp.ok) {
    return {
      ok: false,
      attempts: 1,
      error: smtp.error,
      nonRetryable: true,
    }
  }

  const { subject, text, html } = buildOrderDeliveryEmail({
    ...payload,
    customerEmail: normalizedEmail,
  })

  try {
    const info = await smtp.transporter.sendMail({
      from: fromAddress.from,
      to: normalizedEmail,
      subject,
      text,
      html,
    })

    return {
      ok: true,
      attempts: 1,
      messageId: info.messageId,
    }
  } catch (error: any) {
    return {
      ok: false,
      attempts: 1,
      error: String(error?.message || error || 'smtp_send_failed'),
    }
  }
}

export async function sendOrderDeliveryEmailWithRetry(
  payload: OrderDeliveryEmailPayload,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<DeliveryEmailSendResult> {
  const configuredAttempts = parseInteger(process.env.ORDER_EMAIL_MAX_ATTEMPTS, 3)
  const configuredDelayMs = parseInteger(process.env.ORDER_EMAIL_RETRY_DELAY_MS, 1000)

  const maxAttempts = Math.max(1, options?.maxAttempts || configuredAttempts)
  const baseDelayMs = Math.max(250, options?.baseDelayMs || configuredDelayMs)

  let lastError = 'unknown_email_error'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await sendOrderDeliveryEmailOnce(payload)

    if (result.ok) {
      return {
        ok: true,
        attempts: attempt,
        messageId: result.messageId,
      }
    }

    lastError = result.error || lastError
    if (result.nonRetryable) {
      return {
        ok: false,
        attempts: attempt,
        error: lastError,
        nonRetryable: true,
      }
    }

    if (attempt < maxAttempts) {
      const backoff = baseDelayMs * Math.pow(2, attempt - 1)
      await wait(backoff)
    }
  }

  return {
    ok: false,
    attempts: maxAttempts,
    error: lastError,
  }
}
