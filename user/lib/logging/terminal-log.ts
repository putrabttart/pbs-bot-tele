type LogLevel = 'info' | 'success' | 'warn' | 'error'

type LogFields = Record<string, unknown>

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const

const LEVEL_LABEL: Record<LogLevel, string> = {
  info: 'INFO',
  success: 'SUCCESS',
  warn: 'WARNING',
  error: 'ERROR',
}

function useColor() {
  return process.env.NO_COLOR !== '1' && process.env.TERM !== 'dumb'
}

function paint(text: string, color: string) {
  if (!useColor()) return text
  return `${color}${text}${ANSI.reset}`
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function truncate(value: string, maxLength = 260) {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength)}...`
}

function normalizeScope(scope: string) {
  return String(scope || 'API').replace(/\s+/g, '_').trim().toUpperCase() || 'API'
}

function resolveCategory(scope: string) {
  const normalized = normalizeScope(scope)

  if (normalized.includes('SMTP') || normalized.includes('EMAIL')) return 'EMAIL'
  if (normalized.includes('MIDTRANS') || normalized.includes('PAYMENT') || normalized.includes('WEBHOOK')) return 'PAYMENT'
  if (normalized.includes('CHECKOUT') || normalized.includes('ORDER') || normalized.includes('CANCEL')) return 'CHECKOUT'
  if (normalized.includes('API')) return 'API'

  return 'API'
}

function shouldRedactKey(key: string) {
  return /(pass(word)?|token|secret|authorization|api[_-]?key|server[_-]?key|client[_-]?key|smtp_pass)/i.test(key)
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (shouldRedactKey(key)) return '<redacted>'

  if (typeof value === 'string') return truncate(value)
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)

  if (value instanceof Error) {
    const message = String(value.message || value.name || 'error')
    return truncate(message)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.length <= 6) {
      return `[${value.map((item) => formatValue(key, item)).join(', ')}]`
    }
    return `[len=${value.length}]`
  }

  try {
    return truncate(JSON.stringify(value))
  } catch {
    return truncate(String(value))
  }
}

function formatFields(fields?: LogFields) {
  if (!fields) return ''

  const entries = Object.entries(fields).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return ''

  return entries
    .map(([key, value]) => `${key}=${formatValue(key, value)}`)
    .join(' | ')
}

function resolveStack(fields?: LogFields) {
  if (!fields) return ''

  if (typeof fields.stack === 'string' && fields.stack.trim()) {
    return fields.stack.trim()
  }

  const error = fields.error as any
  if (error && typeof error === 'object' && typeof error.stack === 'string') {
    return String(error.stack).trim()
  }

  return ''
}

function levelColor(level: LogLevel) {
  if (level === 'success') return ANSI.green
  if (level === 'warn') return ANSI.yellow
  if (level === 'error') return ANSI.red
  return ANSI.cyan
}

function categoryColor(category: string) {
  if (category === 'API') return ANSI.blue
  if (category === 'CHECKOUT') return ANSI.magenta
  if (category === 'PAYMENT') return ANSI.cyan
  if (category === 'EMAIL') return ANSI.green
  return ANSI.blue
}

function write(level: LogLevel, scope: string, message: string, fields?: LogFields) {
  const timestamp = formatTimestamp()
  const category = resolveCategory(scope)
  const normalizedScope = normalizeScope(scope)
  const payloadFields: LogFields = normalizedScope !== category
    ? { module: normalizedScope, ...fields }
    : { ...(fields || {}) }

  const suffix = formatFields(payloadFields)
  const prefix = `${paint(`[${timestamp}]`, ANSI.dim)} ${paint(`[${LEVEL_LABEL[level]}]`, levelColor(level))} ${paint(`[${category}]`, categoryColor(category))}`
  const line = suffix ? `${prefix} ${message} | ${suffix}` : `${prefix} ${message}`

  if (level === 'error') {
    console.error(line)
    const stack = resolveStack(fields)
    if (stack) {
      for (const row of stack.split('\n').slice(0, 14)) {
        console.error(`${paint(`[${timestamp}]`, ANSI.dim)} ${paint('[ERROR]', ANSI.red)} ${paint('[STACK]', ANSI.red)} ${row.trim()}`)
      }
    }
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
}

export function logInfo(scope: string, event: string, fields?: LogFields) {
  write('info', scope, event, fields)
}

export function logSuccess(scope: string, event: string, fields?: LogFields) {
  write('success', scope, event, fields)
}

export function logWarn(scope: string, event: string, fields?: LogFields) {
  write('warn', scope, event, fields)
}

export function logError(scope: string, event: string, fields?: LogFields) {
  write('error', scope, event, fields)
}

export function logApi(event: string, fields?: LogFields) {
  write('info', 'API', event, fields)
}

export function logCheckout(event: string, fields?: LogFields, level: LogLevel = 'info') {
  write(level, 'CHECKOUT', event, fields)
}

export function logPayment(event: string, fields?: LogFields, level: LogLevel = 'info') {
  write(level, 'PAYMENT', event, fields)
}

export function logEmail(event: string, fields?: LogFields, level: LogLevel = 'info') {
  write(level, 'EMAIL', event, fields)
}

export function summarizeOrderForLog(order: any) {
  if (!order) return null

  return {
    orderId: String(order.order_id || '-'),
    status: String(order.status || '-'),
    amount: Number(order.total_amount || 0),
    paymentMethod: String(order.payment_method || '-'),
    customerEmail: String(order.customer_email || ''),
    itemCount: Array.isArray(order.items) ? order.items.length : 0,
    deliveryEmailStatus: String(order.delivery_email_status || '-'),
    deliveryEmailAttempts: Number(order.delivery_email_attempts || 0),
  }
}
