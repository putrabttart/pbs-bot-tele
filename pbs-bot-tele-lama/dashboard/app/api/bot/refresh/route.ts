import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3000'
    const webhookSecret = process.env.WEBHOOK_SECRET || 'supersecret-bot'

    // Trigger bot refresh (non-critical, don't block)
    try {
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
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (response.ok) {
        const data = await response.json()
        return NextResponse.json({
          success: true,
          message: 'Bot refreshed successfully',
          data,
        })
      }
    } catch (refreshErr) {
      console.warn('⚠️ Bot refresh notification failed (non-critical):', refreshErr)
      // Don't throw - this is optional
    }

    // Return success even if refresh fails - items are already saved in DB
    return NextResponse.json({
      success: true,
      message: 'Items saved successfully (bot refresh skipped)',
      refreshed: false,
    })
  } catch (error: any) {
    console.error('[REFRESH API ERROR]', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
