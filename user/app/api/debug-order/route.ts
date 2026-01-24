import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    console.log(`[DEBUG] Checking order in database: ${orderId}`)

    // Try to get order from database
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)

    if (dbError) {
      return NextResponse.json({
        error: 'Database error',
        details: dbError,
      }, { status: 500 })
    }

    console.log(`[DEBUG] Found ${orderData?.length || 0} orders with ID ${orderId}`)

    if (orderData && orderData.length > 0) {
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
    console.error('[DEBUG] Error:', error)
    return NextResponse.json({
      error: 'Error checking order',
      message: error.message,
    }, { status: 500 })
  }
}
