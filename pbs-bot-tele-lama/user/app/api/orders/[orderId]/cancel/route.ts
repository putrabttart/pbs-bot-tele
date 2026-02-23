import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId

    console.log(`[Cancel Order] Processing cancellation for order: ${orderId}`)

    // Get order details using order_id (string), not id (UUID)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[Cancel Order] Order not found:', orderError)
      return NextResponse.json(
        { error: 'Order tidak ditemukan' },
        { status: 404 }
      )
    }

    console.log('[Cancel Order] Order found:', { 
      order_id: (order as any).order_id, 
      status: (order as any).status 
    })

    // Allow cancellation for pending and processing orders
    const status = (order as any).status?.toLowerCase() || ''
    if (status === 'completed' || status === 'settlement') {
      console.warn('[Cancel Order] Cannot cancel completed order')
      return NextResponse.json(
        { error: 'Pesanan yang sudah selesai tidak dapat dibatalkan' },
        { status: 400 }
      )
    }

    if (status === 'cancelled' || status === 'cancel') {
      console.warn('[Cancel Order] Order already cancelled')
      return NextResponse.json(
        { error: 'Pesanan sudah dibatalkan sebelumnya' },
        { status: 400 }
      )
    }

    // Release reserved items using RPC function
    console.log('[Cancel Order] Releasing reserved items...')
    
    try {
      const { data: releaseResult, error: releaseError } = await (supabase as any)
        .rpc('release_reserved_items', {
          p_order_id: orderId
        })

      if (releaseError) {
        console.error('[Cancel Order] Failed to release items:', releaseError.message)
        // Continue anyway - update order status even if release fails
      } else {
        console.log('[Cancel Order] Release result:', releaseResult)
        if ((releaseResult as any)?.count > 0) {
          console.log(`[Cancel Order] ✅ Released ${(releaseResult as any).count} reserved items back to stock`)
        } else {
          console.log('[Cancel Order] No reserved items to release (may already be released)')
        }
      }
    } catch (releaseErr: any) {
      console.error('[Cancel Order] Exception releasing items:', releaseErr.message)
      // Continue anyway
    }

    // Update order status to cancelled
    console.log('[Cancel Order] Updating order status to cancelled...')
    
    const { error: updateError } = await (supabase as any)
      .from('orders')
      .update({ 
        status: 'cancelled'
      })
      .eq('order_id', orderId)

    if (updateError) {
      console.error('[Cancel Order] Failed to update order status:', updateError)
      return NextResponse.json(
        { error: 'Gagal membatalkan pesanan' },
        { status: 500 }
      )
    }

    console.log('[Cancel Order] ✅ Order cancelled successfully')

    return NextResponse.json({
      success: true,
      message: 'Pesanan berhasil dibatalkan. Stok telah dikembalikan.'
    })
  } catch (error: any) {
    console.error('[Cancel Order] Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat membatalkan pesanan' },
      { status: 500 }
    )
  }
}
