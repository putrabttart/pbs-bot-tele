import { NextRequest, NextResponse } from 'next/server'
import { logError, logInfo } from '@/lib/logging/terminal-log'

export async function POST(request: NextRequest) {
  let requestOrderId = ''
  try {
    const startedAt = Date.now()
    const { order_id, transaction_id } = await request.json()
    requestOrderId = String(order_id || '')

    if (!order_id && !transaction_id) {
      return NextResponse.json(
        { error: 'order_id or transaction_id required' },
        { status: 400 }
      )
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const apiBase = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    // Check transaction status from Midtrans API
    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const url = `${apiBase}/v2/${encodeURIComponent(order_id)}/status`

    logInfo('Payment Status', 'Polling Midtrans status', {
      orderId: order_id,
      transactionId: transaction_id,
      endpoint: url.split('/').pop(),
    })

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    })

    const text = await response.text()

    if (!response.ok) {
      throw new Error(`Midtrans API error: ${response.status}`)
    }

    const transaction = JSON.parse(text)

    logInfo('Payment Status', 'Polling response received', {
      orderId: transaction.order_id || order_id,
      status: transaction.transaction_status,
      paymentType: transaction.payment_type,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      status: transaction.transaction_status, // settlement, pending, deny, cancel, expire, refund
      transaction_id: transaction.transaction_id,
      order_id: transaction.order_id,
      gross_amount: transaction.gross_amount,
      payment_type: transaction.payment_type,
      transaction_time: transaction.transaction_time,
      fraud_status: transaction.fraud_status,
      statusMessage: getStatusMessage(transaction.transaction_status),
    })
  } catch (error: any) {
    logError('Payment Status', 'Polling failed', {
      orderId: requestOrderId || '-',
      error: error.message,
    })
    return NextResponse.json(
      { error: error.message || 'Failed to check payment status' },
      { status: 500 }
    )
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    settlement: 'Pembayaran berhasil diterima!',
    capture: 'Pembayaran berhasil!',
    pending: 'Pembayaran masih pending...',
    deny: 'Pembayaran ditolak',
    cancel: 'Pembayaran dibatalkan',
    expire: 'QR Code sudah expired',
    refund: 'Pembayaran di-refund',
  }
  return messages[status] || 'Status tidak diketahui'
}
