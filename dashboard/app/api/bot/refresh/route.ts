import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3000'
    const webhookSecret = process.env.WEBHOOK_SECRET || 'supersecret-bot'

    // Trigger bot refresh
    const response = await fetch(`${botUrl}/webhook/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refresh-key': webhookSecret,
      },
      body: JSON.stringify({
        secret: webhookSecret,
        note: 'Dashboard triggered refresh',
      }),
    })

    if (!response.ok) {
      throw new Error('Bot refresh failed')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Bot refreshed successfully',
      data,
    })
  } catch (error: any) {
    console.error('[REFRESH API ERROR]', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to refresh bot',
      },
      { status: 500 }
    )
  }
}
