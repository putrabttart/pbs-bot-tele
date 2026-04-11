import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logError, logInfo, logSuccess, logWarn } from '@/lib/logging/terminal-log'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

function parseAdminIds(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((id) => id.replace(/['"]/g, '').trim())
    .filter(Boolean)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendTelegramToAdmins(text: string, context: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const adminIds = parseAdminIds(process.env.TELEGRAM_ADMIN_IDS)

  if (!token || adminIds.length === 0) {
    logWarn(context, 'Telegram env missing', {
      hasToken: Boolean(token),
      adminCount: adminIds.length,
    })
    return
  }

  await Promise.all(
    adminIds.map(async (chatId) => {
      let lastError = ''

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              disable_web_page_preview: true,
            }),
          })

          if (resp.ok) {
            return
          }

          const body = await resp.text()
          lastError = `HTTP ${resp.status}: ${body.slice(0, 300)}`

          if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
            await sleep(300 * attempt)
            continue
          }

          break
        } catch (err: any) {
          lastError = String(err?.message || err)
          if (attempt < 3) {
            await sleep(300 * attempt)
            continue
          }
        }
      }

      logError(context, 'Telegram send failed', {
        chatId,
        error: lastError || 'unknown_error',
      })
    })
  )
}

async function notifyManualCancelToAdmins(order: any, status: string) {
  const source = order?.user_id !== null && order?.user_id !== undefined ? 'TELEGRAM BOT' : 'WEBSITE'
  const text = `
⌛ ORDER EXPIRED/CANCELLED
───────────────────────
Sumber: ${source}
Order ID: ${String(order?.order_id || '-')}
Amount: ${formatCurrency(Number(order?.total_amount || 0))}
Payment: ${String(order?.payment_method || 'qris').toUpperCase()}
Status: ${String(status || 'cancelled').toUpperCase()}

ℹ️ Dibatalkan dari endpoint cancel order.
───────────────────────
  `

  await sendTelegramToAdmins(text, 'CANCEL:notify-admin')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId

    logInfo('CANCEL', 'Processing cancellation request', { orderId })

    // Get order details using order_id (string), not id (UUID)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (orderError || !order) {
      logError('CANCEL', 'Order not found', {
        orderId,
        error: orderError?.message || 'order_not_found',
      })
      return NextResponse.json(
        { error: 'Order tidak ditemukan' },
        { status: 404 }
      )
    }

    logInfo('CANCEL', 'Order found', {
      orderId: (order as any).order_id,
      status: (order as any).status,
    })

    // Allow cancellation for pending and processing orders
    const status = (order as any).status?.toLowerCase() || ''
    if (status === 'completed' || status === 'settlement') {
      logWarn('CANCEL', 'Cannot cancel completed order', { orderId, status })
      return NextResponse.json(
        { error: 'Pesanan yang sudah selesai tidak dapat dibatalkan' },
        { status: 400 }
      )
    }

    if (status === 'cancelled' || status === 'cancel') {
      logWarn('CANCEL', 'Order already cancelled', { orderId, status })
      return NextResponse.json(
        { error: 'Pesanan sudah dibatalkan sebelumnya' },
        { status: 400 }
      )
    }

    // Release reserved items using RPC function
    logInfo('CANCEL', 'Releasing reserved items', { orderId })
    
    try {
      const { data: releaseResult, error: releaseError } = await (supabase as any)
        .rpc('release_reserved_items', {
          p_order_id: orderId
        })

      if (releaseError) {
        logError('CANCEL', 'Failed to release reserved items', {
          orderId,
          error: releaseError.message,
        })
        // Continue anyway - update order status even if release fails
      } else {
        logInfo('CANCEL', 'Release reserved items response', {
          orderId,
          result: releaseResult,
        })
        if ((releaseResult as any)?.count > 0) {
          logSuccess('CANCEL', 'Reserved items released', {
            orderId,
            releasedCount: (releaseResult as any).count,
          })
        } else {
          logInfo('CANCEL', 'No reserved items to release', { orderId })
        }
      }
    } catch (releaseErr: any) {
      logError('CANCEL', 'Exception releasing reserved items', {
        orderId,
        error: releaseErr?.message || String(releaseErr),
        stack: releaseErr?.stack,
      })
      // Continue anyway
    }

    // Update order status to cancelled
    logInfo('CANCEL', 'Updating order status to cancelled', { orderId })
    
    const { error: updateError } = await (supabase as any)
      .from('orders')
      .update({ 
        status: 'cancelled'
      })
      .eq('order_id', orderId)

    if (updateError) {
      logError('CANCEL', 'Failed to update order status', {
        orderId,
        error: updateError.message,
      })
      return NextResponse.json(
        { error: 'Gagal membatalkan pesanan' },
        { status: 500 }
      )
    }

    logSuccess('CANCEL', 'Order cancelled successfully', { orderId })

    await notifyManualCancelToAdmins(order, 'cancelled')

    return NextResponse.json({
      success: true,
      message: 'Pesanan berhasil dibatalkan. Stok telah dikembalikan.'
    })
  } catch (error: any) {
    logError('CANCEL', 'Unhandled exception', {
      error: String(error?.message || error),
      stack: error?.stack,
    })
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat membatalkan pesanan' },
      { status: 500 }
    )
  }
}
