import nodemailer from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import net from 'node:net'
import { Resend } from 'resend'
import { logError, logInfo, logSuccess, logWarn } from '@/lib/logging/terminal-log'
import {
  buildOrderDeliveryEmail,
  type OrderDeliveryEmailPayload,
} from './order-delivery-template'

type EmailProvider = 'smtp' | 'resend'

export type DeliveryEmailSendResult = {
  ok: boolean
  attempts: number
  error?: string
  messageId?: string
  nonRetryable?: boolean
}

export type SmtpFailureReason =
  | 'SMTP_CONFIG_ERROR'
  | 'SMTP_AUTH_FAILED'
  | 'SMTP_TIMEOUT'
  | 'SMTP_DNS_ERROR'
  | 'SMTP_NETWORK_BLOCKED'
  | 'SMTP_PORT_BLOCKED'
  | 'SMTP_TLS_ERROR'
  | 'SMTP_SENDER_DOMAIN_UNVERIFIED'
  | 'SMTP_SERVER_ERROR'
  | 'SMTP_UNKNOWN_ERROR'
  | 'RESEND_CONFIG_ERROR'
  | 'RESEND_AUTH_FAILED'
  | 'RESEND_RATE_LIMITED'
  | 'RESEND_DOMAIN_UNVERIFIED'
  | 'RESEND_API_ERROR'
  | 'RESEND_UNKNOWN_ERROR'

export type SmtpDiagnosis = {
  reason: SmtpFailureReason
  message: string
  code?: string
  responseCode?: number
  recommendation: string
  shouldCheckSpfDkim: boolean
  likelyServerlessNetworkIssue: boolean
}

export type SmtpConnectionProbeResult = {
  ok: boolean
  durationMs: number
  meta: {
    provider: EmailProvider
    mode: 'smtp_url' | 'smtp_host' | 'resend_api'
    host: string
    port: number
    secure: boolean
    forceIpv4: boolean
    authConfigured: boolean
    senderDomain: string
  }
  diagnosis?: SmtpDiagnosis
}

export type SmtpSendTestResult = {
  ok: boolean
  durationMs: number
  messageId?: string
  diagnosis?: SmtpDiagnosis
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

function normalizeErrorMessage(error: unknown, maxLength = 500) {
  const raw = String(error || 'unknown_error').replace(/\s+/g, ' ').trim()
  if (!raw) return 'unknown_error'
  return raw.length > maxLength ? raw.slice(0, maxLength) : raw
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function redactSensitiveText(text: string) {
  return String(text || '')
    .replace(/(pass(word)?|authorization|auth|token|secret)\s*[:=]\s*[^\s,]+/gi, '$1=<redacted>')
    .replace(/AUTH\s+[A-Z0-9_-]+\s+[A-Za-z0-9+/=]+/gi, 'AUTH <redacted>')
}

function sanitizeSmtpDebugParam(param: unknown) {
  if (param === null || param === undefined) return '-'
  if (typeof param === 'string') return redactSensitiveText(param).slice(0, 300)
  if (param instanceof Error) return redactSensitiveText(param.message || String(param)).slice(0, 300)
  try {
    return redactSensitiveText(JSON.stringify(param)).slice(0, 300)
  } catch {
    return redactSensitiveText(String(param)).slice(0, 300)
  }
}

function createSmtpDebugLogger(): SMTPTransport.Options['logger'] {
  const emit = (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal', ...params: any[]) => {
    const message = params.map((param) => sanitizeSmtpDebugParam(param)).join(' | ')
    if (level === 'warn') {
      logWarn('SMTP', `debug:${level}`, { message })
      return
    }
    if (level === 'error' || level === 'fatal') {
      logError('SMTP', `debug:${level}`, { message })
      return
    }
    logInfo('SMTP', `debug:${level}`, { message })
  }

  return {
    level: () => {
      // no-op for compatibility with Nodemailer logger interface
    },
    trace: (...params: any[]) => emit('trace', ...params),
    debug: (...params: any[]) => emit('debug', ...params),
    info: (...params: any[]) => emit('info', ...params),
    warn: (...params: any[]) => emit('warn', ...params),
    error: (...params: any[]) => emit('error', ...params),
    fatal: (...params: any[]) => emit('fatal', ...params),
  }
}

function resolveEmailProvider(): EmailProvider {
  const explicitProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase()
  if (explicitProvider === 'resend') return 'resend'
  if (explicitProvider === 'smtp') return 'smtp'

  const hasResendConfig = Boolean(
    String(process.env.RESEND_API_KEY || '').trim()
    && String(process.env.RESEND_FROM_EMAIL || '').trim()
  )

  if (hasResendConfig) return 'resend'
  return 'smtp'
}

function resolveSmtpMeta() {
  const smtpUrl = String(process.env.SMTP_URL || '').trim()
  const host = String(process.env.SMTP_HOST || '').trim()
  const port = parseInteger(process.env.SMTP_PORT, 0)
  const secureFromEnv = parseBoolean(process.env.SMTP_SECURE, port === 465)
  const forceIpv4 = parseBoolean(process.env.SMTP_FORCE_IPV4, true)
  const authConfigured = Boolean(String(process.env.SMTP_USER || '').trim() && String(process.env.SMTP_PASS || '').trim())
  const senderEmail = String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '').trim().toLowerCase()
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : ''

  if (smtpUrl) {
    try {
      const url = new URL(smtpUrl)
      const mode = 'smtp_url' as const
      const secure = url.protocol === 'smtps:'
      const resolvedPort = Number(url.port || (secure ? 465 : 587))
      const resolvedHost = String(url.hostname || host || 'smtp').trim()

      return {
        provider: 'smtp' as const,
        mode,
        host: resolvedHost,
        port: resolvedPort,
        secure,
        forceIpv4,
        authConfigured,
        senderDomain,
      }
    } catch {
      return {
        provider: 'smtp' as const,
        mode: 'smtp_url' as const,
        host: host || 'smtp',
        port: port || 587,
        secure: secureFromEnv,
        forceIpv4,
        authConfigured,
        senderDomain,
      }
    }
  }

  return {
    provider: 'smtp' as const,
    mode: 'smtp_host' as const,
    host,
    port,
    secure: secureFromEnv,
    forceIpv4,
    authConfigured,
    senderDomain,
  }
}

function resolveResendMeta() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const fromEmail = String(process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || '').trim().toLowerCase()
  const senderDomain = fromEmail.includes('@') ? fromEmail.split('@')[1] : ''

  return {
    provider: 'resend' as const,
    mode: 'resend_api' as const,
    host: 'api.resend.com',
    port: 443,
    secure: true,
    forceIpv4: false,
    authConfigured: Boolean(apiKey),
    senderDomain,
  }
}

function diagnoseSenderDomain(senderDomain: string) {
  if (!senderDomain) {
    return {
      shouldCheckSpfDkim: false,
      domainAdvice: 'Sender domain belum terdeteksi dari SMTP_FROM_EMAIL/SMTP_USER.',
    }
  }

  const freeDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com']
  const isFreeDomain = freeDomains.includes(senderDomain)

  if (isFreeDomain) {
    return {
      shouldCheckSpfDkim: false,
      domainAdvice: 'Domain pengirim adalah provider email publik; fokus pada App Password, reputasi konten, dan folder spam.',
    }
  }

  return {
    shouldCheckSpfDkim: true,
    domainAdvice: 'Domain pengirim custom terdeteksi; pastikan SPF, DKIM, dan DMARC valid untuk deliverability.',
  }
}

function diagnoseSmtpError(error: any): SmtpDiagnosis {
  const message = normalizeErrorMessage(error?.message || error)
  const lower = message.toLowerCase()
  const code = String(error?.code || '').trim() || undefined
  const responseCode = Number.isFinite(Number(error?.responseCode)) ? Number(error?.responseCode) : undefined

  if (
    code === 'EAUTH'
    || lower.includes('invalid login')
    || lower.includes('auth failed')
    || lower.includes('authentication')
    || lower.includes('535')
  ) {
    return {
      reason: 'SMTP_AUTH_FAILED',
      message,
      code,
      responseCode,
      recommendation: 'Periksa SMTP_USER dan SMTP_PASS. Untuk Gmail gunakan App Password, bukan password akun utama.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (
    code === 'ETIMEDOUT'
    || lower.includes('timeout')
    || lower.includes('timed out')
    || lower.includes('smtp_ipv4_connect_timeout')
  ) {
    return {
      reason: 'SMTP_TIMEOUT',
      message,
      code,
      responseCode,
      recommendation: 'Koneksi SMTP timeout. Cek port (587/465), firewall provider hosting, dan naikkan timeout SMTP_*_TIMEOUT_MS.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: true,
    }
  }

  if (code === 'ENOTFOUND' || lower.includes('getaddrinfo') || lower.includes('dns')) {
    return {
      reason: 'SMTP_DNS_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'Hostname SMTP tidak bisa di-resolve. Periksa SMTP_HOST atau DNS resolver pada environment runtime.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: true,
    }
  }

  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return {
      reason: 'SMTP_NETWORK_BLOCKED',
      message,
      code,
      responseCode,
      recommendation: 'Jaringan runtime tidak bisa menjangkau SMTP server. Cek policy outbound pada serverless/container.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: true,
    }
  }

  if (code === 'ECONNREFUSED' || lower.includes('connection refused')) {
    return {
      reason: 'SMTP_PORT_BLOCKED',
      message,
      code,
      responseCode,
      recommendation: 'Port SMTP ditolak. Validasi SMTP_PORT/SMTP_SECURE dan cek apakah provider hosting memblokir port outbound.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: true,
    }
  }

  if (lower.includes('tls') || lower.includes('certificate') || lower.includes('ssl')) {
    return {
      reason: 'SMTP_TLS_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'Masalah TLS/SSL. Cocokkan SMTP_SECURE dengan port dan pastikan sertifikat SMTP valid.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (
    lower.includes('sender address rejected')
    || lower.includes('mail from command failed')
    || lower.includes('550')
    || lower.includes('5.7.1')
  ) {
    return {
      reason: 'SMTP_SENDER_DOMAIN_UNVERIFIED',
      message,
      code,
      responseCode,
      recommendation: 'Alamat pengirim ditolak server. Pastikan SMTP_FROM_EMAIL valid dan domain sender memiliki SPF/DKIM sesuai provider SMTP.',
      shouldCheckSpfDkim: true,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (typeof responseCode === 'number' && responseCode >= 500) {
    return {
      reason: 'SMTP_SERVER_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'SMTP server merespons error 5xx. Cek status provider SMTP dan policy akun pengirim.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (lower.includes('smtp_host_or_port_missing') || lower.includes('smtp_user_pass_incomplete') || lower.includes('smtp_from_email_missing')) {
    return {
      reason: 'SMTP_CONFIG_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'Konfigurasi SMTP belum lengkap. Pastikan SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM_EMAIL terisi benar.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  return {
    reason: 'SMTP_UNKNOWN_ERROR',
    message,
    code,
    responseCode,
    recommendation: 'Gagal kirim email karena error tak terklasifikasi. Cek stack trace dan aktifkan SMTP_DEBUG untuk detail transport.',
    shouldCheckSpfDkim: false,
    likelyServerlessNetworkIssue: false,
  }
}

function diagnoseResendError(error: any): SmtpDiagnosis {
  const message = normalizeErrorMessage(error?.message || error)
  const lower = message.toLowerCase()
  const code = String(error?.code || error?.name || '').trim() || undefined
  const responseCode = Number.isFinite(Number(error?.statusCode || error?.status || error?.responseCode))
    ? Number(error?.statusCode || error?.status || error?.responseCode)
    : undefined

  if (
    lower.includes('resend_api_key_missing')
    || lower.includes('resend_from_email_missing')
    || lower.includes('missing')
    || lower.includes('required')
  ) {
    return {
      reason: 'RESEND_CONFIG_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'Pastikan EMAIL_PROVIDER=resend, RESEND_API_KEY, dan RESEND_FROM_EMAIL sudah terisi.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (
    responseCode === 401
    || responseCode === 403
    || lower.includes('unauthorized')
    || lower.includes('invalid api key')
  ) {
    return {
      reason: 'RESEND_AUTH_FAILED',
      message,
      code,
      responseCode,
      recommendation: 'RESEND_API_KEY tidak valid atau tidak memiliki izin kirim email.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (responseCode === 429 || lower.includes('rate limit')) {
    return {
      reason: 'RESEND_RATE_LIMITED',
      message,
      code,
      responseCode,
      recommendation: 'Kena rate limit Resend. Tingkatkan delay retry atau upgrade plan Resend jika dibutuhkan.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (
    lower.includes('domain')
    && (lower.includes('verify') || lower.includes('unverified') || lower.includes('not verified'))
  ) {
    return {
      reason: 'RESEND_DOMAIN_UNVERIFIED',
      message,
      code,
      responseCode,
      recommendation: 'Verifikasi domain pengirim di Resend dan pastikan DNS (SPF/DKIM) sudah valid.',
      shouldCheckSpfDkim: true,
      likelyServerlessNetworkIssue: false,
    }
  }

  if (
    code === 'ETIMEDOUT'
    || code === 'ENOTFOUND'
    || code === 'ENETUNREACH'
    || code === 'EHOSTUNREACH'
    || lower.includes('timeout')
    || lower.includes('network')
    || lower.includes('socket')
  ) {
    return {
      reason: 'RESEND_API_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'Gagal menghubungi API Resend. Cek koneksi outbound runtime dan coba ulang.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: true,
    }
  }

  if (typeof responseCode === 'number' && responseCode >= 500) {
    return {
      reason: 'RESEND_API_ERROR',
      message,
      code,
      responseCode,
      recommendation: 'Resend merespons error 5xx. Cek status layanan Resend lalu retry.',
      shouldCheckSpfDkim: false,
      likelyServerlessNetworkIssue: false,
    }
  }

  return {
    reason: 'RESEND_UNKNOWN_ERROR',
    message,
    code,
    responseCode,
    recommendation: 'Gagal kirim email melalui Resend. Cek response error detail dari Resend dashboard/log.',
    shouldCheckSpfDkim: false,
    likelyServerlessNetworkIssue: false,
  }
}

function diagnoseProviderError(provider: EmailProvider, error: any): SmtpDiagnosis {
  return provider === 'resend' ? diagnoseResendError(error) : diagnoseSmtpError(error)
}

function resolveFromAddress(provider: EmailProvider = resolveEmailProvider()) {
  const fallbackName = String(process.env.SMTP_FROM_NAME || 'Putra BTT Store').trim()
  const fromEmail = provider === 'resend'
    ? String(process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || '').trim()
    : String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '').trim()

  const fromName = provider === 'resend'
    ? String(process.env.RESEND_FROM_NAME || fallbackName).trim()
    : fallbackName

  if (!fromEmail) {
    return {
      ok: false as const,
      error: provider === 'resend' ? 'resend_from_email_missing' : 'smtp_from_email_missing',
    }
  }

  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
  return { ok: true as const, from, fromEmail }
}

function createSmtpTransport() {
  const meta = resolveSmtpMeta()
  const smtpUrl = String(process.env.SMTP_URL || '').trim()
  const connectionTimeout = Math.max(12000, parseInteger(process.env.SMTP_CONNECTION_TIMEOUT_MS, 12000))
  const greetingTimeout = Math.max(12000, parseInteger(process.env.SMTP_GREETING_TIMEOUT_MS, 12000))
  const socketTimeout = Math.max(20000, parseInteger(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000))
  const dnsTimeout = Math.max(12000, parseInteger(process.env.SMTP_DNS_TIMEOUT_MS, 12000))
  const forceIpv4 = meta.forceIpv4
  const smtpDebug = parseBoolean(process.env.SMTP_DEBUG, false)
  const smtpDebugTransactionLog = parseBoolean(process.env.SMTP_DEBUG_TRANSACTION_LOG, true)

  try {
    if (smtpUrl) {
      const defaults: SMTPTransport.Options | undefined = smtpDebug
        ? {
            debug: true,
            transactionLog: smtpDebugTransactionLog,
            logger: createSmtpDebugLogger(),
          }
        : undefined

      if (smtpDebug) {
        logInfo('SMTP', 'Using SMTP_URL transport', {
          debug: smtpDebug,
          transactionLog: smtpDebugTransactionLog,
          ...meta,
          connectionTimeout,
          greetingTimeout,
          socketTimeout,
          dnsTimeout,
        })
      }

      return {
        ok: true as const,
        transporter: nodemailer.createTransport(smtpUrl, defaults),
        meta,
      }
    }

    const host = meta.host
    const port = meta.port
    const user = String(process.env.SMTP_USER || '').trim()
    const rawPass = String(process.env.SMTP_PASS || '').trim()
    const pass = rawPass.includes(' ') ? rawPass.replace(/\s+/g, '') : rawPass

    if (!host || !port) {
      return { ok: false as const, error: 'smtp_host_or_port_missing', meta }
    }

    if ((user && !pass) || (!user && pass)) {
      return { ok: false as const, error: 'smtp_user_pass_incomplete', meta }
    }

    const secure = parseBoolean(process.env.SMTP_SECURE, meta.secure)

    const transportOptions: SMTPTransport.Options = {
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout,
      greetingTimeout,
      socketTimeout,
      dnsTimeout,
    }

    if (forceIpv4) {
      transportOptions.getSocket = (options, callback) => {
        const targetHost = String(options.host || host)
        const targetPort = Number(options.port || port)
        const connectTimeoutMs = Math.max(3000, connectionTimeout)

        let settled = false
        const finish = (error?: Error | null, socketOptions?: any) => {
          if (settled) return
          settled = true
          callback(error || null, socketOptions)
        }

        const socket = net.connect({
          host: targetHost,
          port: targetPort,
          family: 4,
        })

        socket.setTimeout(connectTimeoutMs)
        socket.once('timeout', () => {
          socket.destroy()
          finish(new Error('smtp_ipv4_connect_timeout'))
        })

        socket.once('connect', () => {
          socket.setTimeout(0)
          finish(null, { connection: socket })
        })
        socket.once('error', (error: Error) => finish(error))
      }
    }

    if (smtpDebug) {
      transportOptions.debug = true
      transportOptions.transactionLog = smtpDebugTransactionLog
      transportOptions.logger = createSmtpDebugLogger()
      logInfo('SMTP', 'SMTP transport configured', {
        ...meta,
        secure,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
        dnsTimeout,
      })
    }

    return {
      ok: true as const,
      transporter: nodemailer.createTransport(transportOptions),
      meta: {
        ...meta,
        secure,
      },
    }
  } catch (error: unknown) {
    const diagnosis = diagnoseSmtpError(error)
    return {
      ok: false as const,
      error: `smtp_transport_init_failed:${normalizeErrorMessage(error)}`,
      diagnosis,
      meta,
    }
  }
}

let resendClientCache: { apiKey: string; client: Resend } | null = null

function getResendClient() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    return { ok: false as const, error: 'resend_api_key_missing', meta: resolveResendMeta() }
  }

  if (!resendClientCache || resendClientCache.apiKey !== apiKey) {
    resendClientCache = {
      apiKey,
      client: new Resend(apiKey),
    }
  }

  return {
    ok: true as const,
    client: resendClientCache.client,
    meta: resolveResendMeta(),
  }
}

function isNonRetryableReason(reason: SmtpFailureReason) {
  return [
    'SMTP_CONFIG_ERROR',
    'SMTP_AUTH_FAILED',
    'SMTP_SENDER_DOMAIN_UNVERIFIED',
    'RESEND_CONFIG_ERROR',
    'RESEND_AUTH_FAILED',
    'RESEND_DOMAIN_UNVERIFIED',
  ].includes(reason)
}

async function sendOrderDeliveryEmailOnceWithSmtp(payload: OrderDeliveryEmailPayload): Promise<DeliveryEmailSendResult> {
  const verifyBeforeSend = parseBoolean(process.env.SMTP_VERIFY_BEFORE_SEND, true)

  const normalizedEmail = normalizeCustomerEmail(payload.customerEmail)
  if (!isValidCustomerEmail(normalizedEmail)) {
    return {
      ok: false,
      attempts: 1,
      error: 'invalid_customer_email',
      nonRetryable: true,
    }
  }

  const fromAddress = resolveFromAddress('smtp')
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
    const diagnosis = smtp.diagnosis || diagnoseProviderError('smtp', smtp.error)
    const senderDiag = diagnoseSenderDomain(String(smtp.meta?.senderDomain || ''))
    logError('SMTP', 'SMTP transport initialization failed', {
      reason: diagnosis.reason,
      error: diagnosis.message,
      code: diagnosis.code,
      responseCode: diagnosis.responseCode,
      recommendation: diagnosis.recommendation,
      shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
      domainAdvice: senderDiag.domainAdvice,
      likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
      ...smtp.meta,
    })
    return {
      ok: false,
      attempts: 1,
      error: diagnosis.reason,
      nonRetryable: true,
    }
  }

  const senderDiag = diagnoseSenderDomain(smtp.meta.senderDomain)
  if (senderDiag.shouldCheckSpfDkim) {
    logWarn('SMTP', 'Sender domain requires SPF/DKIM verification', {
      senderDomain: smtp.meta.senderDomain,
      domainAdvice: senderDiag.domainAdvice,
    })
  }

  const { subject, text, html } = buildOrderDeliveryEmail({
    ...payload,
    customerEmail: normalizedEmail,
  })

  if (verifyBeforeSend) {
    const verifyStartedAt = Date.now()
    try {
      await smtp.transporter.verify()
      logInfo('SMTP', 'SMTP connection established', {
        to: normalizedEmail,
        orderId: payload.orderId,
        durationMs: Date.now() - verifyStartedAt,
        ...smtp.meta,
      })
    } catch (error: any) {
      const diagnosis = diagnoseProviderError('smtp', error)
      logError('SMTP', 'SMTP connection verification failed', {
        durationMs: Date.now() - verifyStartedAt,
        reason: diagnosis.reason,
        error: diagnosis.message,
        code: diagnosis.code,
        responseCode: diagnosis.responseCode,
        recommendation: diagnosis.recommendation,
        shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
        domainAdvice: senderDiag.domainAdvice,
        likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
        to: normalizedEmail,
        orderId: payload.orderId,
        ...smtp.meta,
        stack: error?.stack,
      })
      return {
        ok: false,
        attempts: 1,
        error: diagnosis.reason,
      }
    }
  }

  try {
    logInfo('SMTP', 'Sending email', {
      to: normalizedEmail,
      orderId: payload.orderId,
      subject,
      ...smtp.meta,
    })

    const sendStartedAt = Date.now()
    const info = await smtp.transporter.sendMail({
      from: fromAddress.from,
      to: normalizedEmail,
      subject,
      text,
      html,
    })

    logSuccess('SMTP', 'Email sent successfully', {
      to: normalizedEmail,
      orderId: payload.orderId,
      durationMs: Date.now() - sendStartedAt,
      messageId: info.messageId,
      ...smtp.meta,
    })

    return {
      ok: true,
      attempts: 1,
      messageId: info.messageId,
    }
  } catch (error: any) {
    const diagnosis = diagnoseProviderError('smtp', error)
    logError('SMTP', 'Email sending failed', {
      reason: diagnosis.reason,
      error: diagnosis.message,
      code: diagnosis.code,
      responseCode: diagnosis.responseCode,
      recommendation: diagnosis.recommendation,
      shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
      domainAdvice: senderDiag.domainAdvice,
      likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
      to: normalizedEmail,
      orderId: payload.orderId,
      ...smtp.meta,
      stack: error?.stack,
    })
    return {
      ok: false,
      attempts: 1,
      error: diagnosis.reason,
    }
  }
}

async function sendOrderDeliveryEmailOnceWithResend(payload: OrderDeliveryEmailPayload): Promise<DeliveryEmailSendResult> {
  const normalizedEmail = normalizeCustomerEmail(payload.customerEmail)
  if (!isValidCustomerEmail(normalizedEmail)) {
    return {
      ok: false,
      attempts: 1,
      error: 'invalid_customer_email',
      nonRetryable: true,
    }
  }

  const fromAddress = resolveFromAddress('resend')
  if (!fromAddress.ok) {
    const diagnosis = diagnoseProviderError('resend', fromAddress.error)
    logError('RESEND', 'Resend sender configuration missing', {
      reason: diagnosis.reason,
      error: diagnosis.message,
      recommendation: diagnosis.recommendation,
    })
    return {
      ok: false,
      attempts: 1,
      error: diagnosis.reason,
      nonRetryable: true,
    }
  }

  const resendClient = getResendClient()
  if (!resendClient.ok) {
    const diagnosis = diagnoseProviderError('resend', resendClient.error)
    logError('RESEND', 'Resend client initialization failed', {
      reason: diagnosis.reason,
      error: diagnosis.message,
      recommendation: diagnosis.recommendation,
      ...resendClient.meta,
    })
    return {
      ok: false,
      attempts: 1,
      error: diagnosis.reason,
      nonRetryable: true,
    }
  }

  const senderDiag = diagnoseSenderDomain(resendClient.meta.senderDomain)
  if (senderDiag.shouldCheckSpfDkim) {
    logWarn('RESEND', 'Sender domain should be verified in Resend', {
      senderDomain: resendClient.meta.senderDomain,
      domainAdvice: senderDiag.domainAdvice,
    })
  }

  const { subject, text, html } = buildOrderDeliveryEmail({
    ...payload,
    customerEmail: normalizedEmail,
  })

  try {
    logInfo('RESEND', 'Sending email', {
      to: normalizedEmail,
      orderId: payload.orderId,
      subject,
      ...resendClient.meta,
    })

    const sendStartedAt = Date.now()
    const response = await resendClient.client.emails.send({
      from: fromAddress.from,
      to: [normalizedEmail],
      subject,
      text,
      html,
    })

    if (response.error) {
      const diagnosis = diagnoseProviderError('resend', response.error)
      logError('RESEND', 'Email sending failed', {
        reason: diagnosis.reason,
        error: diagnosis.message,
        code: diagnosis.code,
        responseCode: diagnosis.responseCode,
        recommendation: diagnosis.recommendation,
        shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
        domainAdvice: senderDiag.domainAdvice,
        likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
        to: normalizedEmail,
        orderId: payload.orderId,
        ...resendClient.meta,
      })

      return {
        ok: false,
        attempts: 1,
        error: diagnosis.reason,
        nonRetryable: isNonRetryableReason(diagnosis.reason),
      }
    }

    const messageId = String(response.data?.id || '')
    logSuccess('RESEND', 'Email sent successfully', {
      to: normalizedEmail,
      orderId: payload.orderId,
      durationMs: Date.now() - sendStartedAt,
      messageId: messageId || '-',
      ...resendClient.meta,
    })

    return {
      ok: true,
      attempts: 1,
      messageId,
    }
  } catch (error: any) {
    const diagnosis = diagnoseProviderError('resend', error)
    logError('RESEND', 'Email sending failed', {
      reason: diagnosis.reason,
      error: diagnosis.message,
      code: diagnosis.code,
      responseCode: diagnosis.responseCode,
      recommendation: diagnosis.recommendation,
      shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
      domainAdvice: senderDiag.domainAdvice,
      likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
      to: normalizedEmail,
      orderId: payload.orderId,
      ...resendClient.meta,
      stack: error?.stack,
    })

    return {
      ok: false,
      attempts: 1,
      error: diagnosis.reason,
      nonRetryable: isNonRetryableReason(diagnosis.reason),
    }
  }
}

async function sendOrderDeliveryEmailOnce(payload: OrderDeliveryEmailPayload): Promise<DeliveryEmailSendResult> {
  const provider = resolveEmailProvider()
  if (provider === 'resend') {
    return sendOrderDeliveryEmailOnceWithResend(payload)
  }
  return sendOrderDeliveryEmailOnceWithSmtp(payload)
}

export async function probeSmtpConnection(): Promise<SmtpConnectionProbeResult> {
  const startedAt = Date.now()
  const provider = resolveEmailProvider()

  if (provider === 'resend') {
    const meta = resolveResendMeta()
    const fromAddress = resolveFromAddress('resend')
    const senderDiag = diagnoseSenderDomain(meta.senderDomain)

    const baseError = !meta.authConfigured
      ? 'resend_api_key_missing'
      : (!fromAddress.ok ? fromAddress.error : '')

    if (baseError) {
      const diagnosis = diagnoseProviderError('resend', baseError)
      const normalizedDiagnosis: SmtpDiagnosis = {
        ...diagnosis,
        shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
      }

      logError('RESEND', 'Resend configuration check failed', {
        reason: normalizedDiagnosis.reason,
        error: normalizedDiagnosis.message,
        recommendation: normalizedDiagnosis.recommendation,
        domainAdvice: senderDiag.domainAdvice,
        shouldCheckSpfDkim: normalizedDiagnosis.shouldCheckSpfDkim,
        likelyServerlessNetworkIssue: normalizedDiagnosis.likelyServerlessNetworkIssue,
        ...meta,
      })

      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        meta,
        diagnosis: normalizedDiagnosis,
      }
    }

    if (senderDiag.shouldCheckSpfDkim) {
      logWarn('RESEND', 'Sender domain should be verified in Resend', {
        senderDomain: meta.senderDomain,
        domainAdvice: senderDiag.domainAdvice,
      })
    }

    logSuccess('RESEND', 'Resend configuration is valid', {
      durationMs: Date.now() - startedAt,
      ...meta,
      domainAdvice: senderDiag.domainAdvice,
      shouldCheckSpfDkim: senderDiag.shouldCheckSpfDkim,
    })

    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      meta,
    }
  }

  const smtp = createSmtpTransport()

  if (!smtp.ok) {
    const diagnosis = smtp.diagnosis || diagnoseProviderError('smtp', smtp.error)
    const senderDiag = diagnoseSenderDomain(String(smtp.meta?.senderDomain || ''))
    const normalizedDiagnosis: SmtpDiagnosis = {
      ...diagnosis,
      shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
    }

    logError('SMTP', 'SMTP connection failed', {
      reason: normalizedDiagnosis.reason,
      error: normalizedDiagnosis.message,
      code: normalizedDiagnosis.code,
      responseCode: normalizedDiagnosis.responseCode,
      recommendation: normalizedDiagnosis.recommendation,
      domainAdvice: senderDiag.domainAdvice,
      shouldCheckSpfDkim: normalizedDiagnosis.shouldCheckSpfDkim,
      likelyServerlessNetworkIssue: normalizedDiagnosis.likelyServerlessNetworkIssue,
      ...smtp.meta,
    })

    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      meta: smtp.meta || resolveSmtpMeta(),
      diagnosis: normalizedDiagnosis,
    }
  }

  const senderDiag = diagnoseSenderDomain(smtp.meta.senderDomain)

  try {
    await smtp.transporter.verify()
    logSuccess('SMTP', 'SMTP connection established', {
      durationMs: Date.now() - startedAt,
      ...smtp.meta,
      domainAdvice: senderDiag.domainAdvice,
      shouldCheckSpfDkim: senderDiag.shouldCheckSpfDkim,
    })

    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      meta: smtp.meta,
    }
  } catch (error: any) {
    const diagnosis = diagnoseProviderError('smtp', error)
    const normalizedDiagnosis: SmtpDiagnosis = {
      ...diagnosis,
      shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim || senderDiag.shouldCheckSpfDkim,
    }

    logError('SMTP', 'SMTP connection failed', {
      reason: normalizedDiagnosis.reason,
      error: normalizedDiagnosis.message,
      code: normalizedDiagnosis.code,
      responseCode: normalizedDiagnosis.responseCode,
      recommendation: normalizedDiagnosis.recommendation,
      domainAdvice: senderDiag.domainAdvice,
      shouldCheckSpfDkim: normalizedDiagnosis.shouldCheckSpfDkim,
      likelyServerlessNetworkIssue: normalizedDiagnosis.likelyServerlessNetworkIssue,
      ...smtp.meta,
      stack: error?.stack,
    })

    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      meta: smtp.meta,
      diagnosis: normalizedDiagnosis,
    }
  }
}

export async function sendSmtpTestEmail(params: {
  to: string
  subject?: string
  text?: string
  html?: string
}): Promise<SmtpSendTestResult> {
  const startedAt = Date.now()
  const provider = resolveEmailProvider()
  const to = normalizeCustomerEmail(params.to)

  if (!isValidCustomerEmail(to)) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      diagnosis: {
        reason: provider === 'resend' ? 'RESEND_CONFIG_ERROR' : 'SMTP_CONFIG_ERROR',
        message: 'Invalid target email',
        recommendation: 'Gunakan alamat email tujuan yang valid untuk endpoint test.',
        shouldCheckSpfDkim: false,
        likelyServerlessNetworkIssue: false,
      },
    }
  }

  const fromAddress = resolveFromAddress(provider)
  if (!fromAddress.ok) {
    const diagnosis = diagnoseProviderError(provider, fromAddress.error)
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      diagnosis,
    }
  }

  const subjectPrefix = provider === 'resend' ? 'Resend Test' : 'SMTP Test'
  const subject = params.subject || `${subjectPrefix} ${new Date().toISOString()}`

  if (provider === 'resend') {
    const resendClient = getResendClient()
    if (!resendClient.ok) {
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        diagnosis: diagnoseProviderError('resend', resendClient.error),
      }
    }

    const text = params.text || [
      'Ini email test dari endpoint /api/test-email.',
      `Waktu: ${new Date().toISOString()}`,
      `Provider: ${resendClient.meta.provider}`,
      `Host API: ${resendClient.meta.host}`,
      'Jika email ini masuk, maka integrasi Resend sudah berjalan.',
    ].join('\n')

    try {
      logInfo('RESEND', 'Sending test email', {
        to,
        subject,
        ...resendClient.meta,
        testMode: true,
      })

      const response = await resendClient.client.emails.send({
        from: fromAddress.from,
        to: [to],
        subject,
        text,
        html: params.html,
      })

      if (response.error) {
        const diagnosis = diagnoseProviderError('resend', response.error)
        logError('RESEND', 'Test email sending failed', {
          reason: diagnosis.reason,
          error: diagnosis.message,
          code: diagnosis.code,
          responseCode: diagnosis.responseCode,
          recommendation: diagnosis.recommendation,
          shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim,
          likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
          to,
          testMode: true,
          ...resendClient.meta,
        })

        return {
          ok: false,
          durationMs: Date.now() - startedAt,
          diagnosis,
        }
      }

      const messageId = String(response.data?.id || '')
      logSuccess('RESEND', 'Test email sent successfully', {
        to,
        messageId: messageId || '-',
        durationMs: Date.now() - startedAt,
        testMode: true,
        ...resendClient.meta,
      })

      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        messageId,
      }
    } catch (error: any) {
      const diagnosis = diagnoseProviderError('resend', error)
      logError('RESEND', 'Test email sending failed', {
        reason: diagnosis.reason,
        error: diagnosis.message,
        code: diagnosis.code,
        responseCode: diagnosis.responseCode,
        recommendation: diagnosis.recommendation,
        shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim,
        likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
        to,
        testMode: true,
        ...resendClient.meta,
        stack: error?.stack,
      })

      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        diagnosis,
      }
    }
  }

  const smtp = createSmtpTransport()
  if (!smtp.ok) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      diagnosis: smtp.diagnosis || diagnoseProviderError('smtp', smtp.error),
    }
  }

  const text = params.text || [
    'Ini email test dari endpoint /api/test-email.',
    `Waktu: ${new Date().toISOString()}`,
    `Host: ${smtp.meta.host}:${smtp.meta.port}`,
    'Jika email ini masuk, maka SMTP connection + sendMail berjalan.',
  ].join('\n')

  try {
    await smtp.transporter.verify()
    logInfo('SMTP', 'SMTP connection established', {
      to,
      ...smtp.meta,
    })

    logInfo('SMTP', 'Sending email', {
      to,
      subject,
      ...smtp.meta,
      testMode: true,
    })

    const info = await smtp.transporter.sendMail({
      from: fromAddress.from,
      to,
      subject,
      text,
      html: params.html,
    })

    logSuccess('SMTP', 'Email sent successfully', {
      to,
      messageId: info.messageId,
      durationMs: Date.now() - startedAt,
      testMode: true,
      ...smtp.meta,
    })

    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      messageId: info.messageId,
    }
  } catch (error: any) {
    const diagnosis = diagnoseProviderError('smtp', error)
    logError('SMTP', 'Email sending failed', {
      reason: diagnosis.reason,
      error: diagnosis.message,
      code: diagnosis.code,
      responseCode: diagnosis.responseCode,
      recommendation: diagnosis.recommendation,
      shouldCheckSpfDkim: diagnosis.shouldCheckSpfDkim,
      likelyServerlessNetworkIssue: diagnosis.likelyServerlessNetworkIssue,
      to,
      testMode: true,
      ...smtp.meta,
      stack: error?.stack,
    })

    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      diagnosis,
    }
  }
}

export async function sendOrderDeliveryEmailWithRetry(
  payload: OrderDeliveryEmailPayload,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<DeliveryEmailSendResult> {
  const configuredAttempts = Math.max(4, parseInteger(process.env.ORDER_EMAIL_MAX_ATTEMPTS, 4))
  const configuredDelayMs = Math.max(1500, parseInteger(process.env.ORDER_EMAIL_RETRY_DELAY_MS, 1500))

  const maxAttempts = Math.max(1, options?.maxAttempts || configuredAttempts)
  const baseDelayMs = Math.max(250, options?.baseDelayMs || configuredDelayMs)

  let lastError = 'unknown_email_error'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: DeliveryEmailSendResult

    try {
      result = await sendOrderDeliveryEmailOnce(payload)
    } catch (error: unknown) {
      result = {
        ok: false,
        attempts: 1,
        error: `delivery_email_unhandled_exception:${normalizeErrorMessage(error)}`,
      }
    }

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
