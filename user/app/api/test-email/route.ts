import { NextRequest, NextResponse } from 'next/server'
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  probeSmtpConnection,
  sendSmtpTestEmail,
} from '@/lib/email/smtp-delivery'
import { logError, logInfo, logSuccess, logWarn } from '@/lib/logging/terminal-log'

function resolveTargetEmail(raw?: string | null) {
  const candidate = String(
    raw
      || process.env.SMTP_TEST_TO
      || process.env.SMTP_USER
      || process.env.SMTP_FROM_EMAIL
      || ''
  ).trim()
  return normalizeCustomerEmail(candidate)
}

async function runEmailTest(targetEmail: string, subject?: string, text?: string) {
  const startedAt = Date.now()

  logInfo('API', 'Test email request started', {
    route: '/api/test-email',
    targetEmail,
  })

  const connectionProbe = await probeSmtpConnection()

  let emailSendStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  let sendError = ''
  let sendDurationMs = 0
  let messageId = ''

  if (!connectionProbe.ok) {
    logWarn('API', 'Skip test send because SMTP connection probe failed', {
      route: '/api/test-email',
      targetEmail,
      reason: connectionProbe.diagnosis?.reason,
    })
  } else {
    const sendResult = await sendSmtpTestEmail({
      to: targetEmail,
      subject,
      text,
    })

    sendDurationMs = sendResult.durationMs
    messageId = String(sendResult.messageId || '')

    if (sendResult.ok) {
      emailSendStatus = 'sent'
    } else {
      emailSendStatus = 'failed'
      sendError = String(sendResult.diagnosis?.message || sendResult.diagnosis?.reason || 'smtp_send_failed')
    }
  }

  const errorMessage = !connectionProbe.ok
    ? String(connectionProbe.diagnosis?.message || connectionProbe.diagnosis?.reason || 'smtp_connection_failed')
    : sendError

  const responseBody = {
    success: connectionProbe.ok && emailSendStatus === 'sent',
    smtp_connection: connectionProbe.ok ? 'ok' : 'failed',
    email_send_status: emailSendStatus,
    error_message: errorMessage || null,
    target_email: targetEmail,
    total_duration_ms: Date.now() - startedAt,
    diagnostics: {
      connection: {
        duration_ms: connectionProbe.durationMs,
        reason: connectionProbe.diagnosis?.reason || null,
        recommendation: connectionProbe.diagnosis?.recommendation || null,
        should_check_spf_dkim: connectionProbe.diagnosis?.shouldCheckSpfDkim || false,
        likely_serverless_network_issue: connectionProbe.diagnosis?.likelyServerlessNetworkIssue || false,
        meta: connectionProbe.meta,
      },
      send: {
        duration_ms: sendDurationMs,
        message_id: messageId || null,
      },
    },
  }

  if (responseBody.success) {
    logSuccess('API', 'Test email completed successfully', {
      route: '/api/test-email',
      targetEmail,
      totalDurationMs: responseBody.total_duration_ms,
      messageId: messageId || '-',
    })
  } else {
    logError('API', 'Test email failed', {
      route: '/api/test-email',
      targetEmail,
      smtpConnection: responseBody.smtp_connection,
      emailSendStatus: responseBody.email_send_status,
      error: responseBody.error_message,
      reason: connectionProbe.diagnosis?.reason || '-',
    })
  }

  return responseBody
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetEmail = resolveTargetEmail(searchParams.get('to'))

  if (!targetEmail || !isValidCustomerEmail(targetEmail)) {
    return NextResponse.json(
      {
        success: false,
        smtp_connection: 'failed',
        email_send_status: 'skipped',
        error_message: 'Invalid or missing target email. Set query to=... or SMTP_TEST_TO env.',
      },
      { status: 400 }
    )
  }

  const subject = String(searchParams.get('subject') || '').trim() || undefined
  const text = String(searchParams.get('text') || '').trim() || undefined
  const result = await runEmailTest(targetEmail, subject, text)

  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const targetEmail = resolveTargetEmail(body?.to)

    if (!targetEmail || !isValidCustomerEmail(targetEmail)) {
      return NextResponse.json(
        {
          success: false,
          smtp_connection: 'failed',
          email_send_status: 'skipped',
          error_message: 'Invalid or missing target email in body.to or SMTP_TEST_TO env.',
        },
        { status: 400 }
      )
    }

    const subject = String(body?.subject || '').trim() || undefined
    const text = String(body?.text || '').trim() || undefined

    const result = await runEmailTest(targetEmail, subject, text)

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (error: any) {
    logError('API', 'Unhandled error in /api/test-email', {
      route: '/api/test-email',
      error: String(error?.message || error),
      stack: error?.stack,
    })

    return NextResponse.json(
      {
        success: false,
        smtp_connection: 'failed',
        email_send_status: 'failed',
        error_message: String(error?.message || 'Unhandled test-email error'),
      },
      { status: 500 }
    )
  }
}
