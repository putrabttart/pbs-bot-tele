import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logError, logInfo, logSuccess } from '@/lib/logging/terminal-log'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

/**
 * DEBUG ENDPOINT - Check what's in database for an order
 * GET /api/debug-order?orderId=PBS-XXX
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')

  if (!orderId) {
    return NextResponse.json(
      { error: 'Missing orderId parameter' },
      { status: 400 }
    )
  }

  try {
    logInfo('API', 'Debug order check started', {
      route: '/api/debug-order',
      orderId,
    })

    // Try to get order from database
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)

    if (dbError) {
      logError('API', 'Debug order database query failed', {
        route: '/api/debug-order',
        orderId,
        error: dbError.message,
      })
      return NextResponse.json({
        error: 'Database error',
        details: dbError,
      }, { status: 500 })
    }

    logInfo('API', 'Debug order query completed', {
      route: '/api/debug-order',
      orderId,
      foundCount: orderData?.length || 0,
    })

    if (orderData && orderData.length > 0) {
      logSuccess('API', 'Debug order found', {
        route: '/api/debug-order',
        orderId,
      })
      return NextResponse.json({
        success: true,
        found: true,
        count: orderData.length,
        order: orderData[0],
      })
    } else {
      return NextResponse.json({
        success: true,
        found: false,
        message: `Order ${orderId} tidak ditemukan di database`,
        checkpoints: [
          '✅ Database connection OK',
          '❌ Order NOT found',
          'Kemungkinan: INSERT di checkout failed'
        ]
      })
    }
  } catch (error: any) {
    logError('API', 'Unhandled debug-order error', {
      route: '/api/debug-order',
      orderId,
      error: String(error?.message || error),
      stack: error?.stack,
    })
    return NextResponse.json({
      error: 'Error checking order',
      message: error.message,
    }, { status: 500 })
  }
}
