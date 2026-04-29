import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3000'
  const webhookSecret = process.env.WEBHOOK_SECRET || 'supersecret-bot'

  try {
    const response = await fetch(`${botUrl}/webhook/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-key': webhookSecret,
      },
      body: JSON.stringify({
        secret: webhookSecret,
        source: 'dashboard',
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000), // 8 second timeout (bot needs time to query DB)
    })

    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({
        success: true,
        refreshed: true,
        message: 'Bot cache refreshed successfully',
        data,
      })
    }

    // Bot responded but with error status
    const errText = await response.text().catch(() => 'unknown')
    console.warn(`⚠️ Bot refresh returned ${response.status}: ${errText}`)
    return NextResponse.json({
      success: true,
      refreshed: false,
      message: `Bot refresh failed (HTTP ${response.status}). Data saved to DB — bot will pick up changes on next auto-refresh.`,
    })
  } catch (refreshErr: any) {
    // Network error, timeout, bot unreachable
    const reason = refreshErr?.name === 'TimeoutError' ? 'timeout' : refreshErr?.message || 'unknown'
    console.warn(`⚠️ Bot refresh failed (${reason})`)

    return NextResponse.json({
      success: true,
      refreshed: false,
      message: `Bot unreachable (${reason}). Data saved to DB — bot will pick up changes via Realtime subscription or next auto-refresh.`,
    })
  }
}
