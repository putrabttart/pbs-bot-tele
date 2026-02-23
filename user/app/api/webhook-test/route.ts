import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * TEST ENDPOINT - Manual webhook testing (untuk debug saja)
 * Gunakan untuk test webhook signature verification tanpa perlu Midtrans real payment
 * 
 * Usage:
 * POST /api/webhook-test?orderId=PBS-xxx&amount=1000&status=settlement
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const orderId = searchParams.get('orderId') || 'PBS-TEST-1771870369795'
  const amount = searchParams.get('amount') || '1000'
  const status = searchParams.get('status') || 'settlement'
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''

  console.log('[WEBHOOK-TEST] Manual test webhook')
  console.log('  Order ID:', orderId)
  console.log('  Amount:', amount)
  console.log('  Status:', status)

  if (!serverKey) {
    return NextResponse.json(
      { error: 'MIDTRANS_SERVER_KEY not configured' },
      { status: 500 }
    )
  }

  // Generate valid signature
  const statusCode = status === 'settlement' ? '200' : '100'
  const rawSignature = orderId + statusCode + amount + serverKey
  const signatureKey = crypto
    .createHash('sha512')
    .update(rawSignature)
    .digest('hex')

  console.log('[WEBHOOK-TEST] Generated valid signature:', signatureKey.substring(0, 20) + '...')

  // Create mock webhook payload
  const mockPayload = {
    transaction_time: new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0],
    transaction_status: status,
    transaction_id: 'test-' + Date.now(),
    status_message: 'Settlement notification',
    status_code: statusCode,
    signature_key: signatureKey,
    settlement_time: new Date().toISOString(),
    payment_type: 'qris',
    order_id: orderId,
    merchant_id: 'G810582154',
    gross_amount: amount,
    fraud_status: 'accept',
    currency: 'IDR',
  }

  console.log('[WEBHOOK-TEST] Mock payload created:')
  console.log(JSON.stringify(mockPayload, null, 2))

  // Forward to actual webhook endpoint
  console.log('[WEBHOOK-TEST] Forwarding to /api/webhook...')
  try {
    const response = await fetch(
      new URL('/api/webhook', request.nextUrl.origin),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPayload),
      }
    )

    const result = await response.json()
    console.log('[WEBHOOK-TEST] Webhook response:', result)

    return NextResponse.json({
      success: true,
      message: 'Webhook test sent',
      payload: mockPayload,
      webhookResponse: result,
    })
  } catch (err: any) {
    console.error('[WEBHOOK-TEST] Error:', err.message)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Webhook Test Endpoint',
    usage: 'POST /api/webhook-test?orderId=PBS-xxx&amount=1000&status=settlement',
    params: {
      orderId: 'Order ID (default: PBS-TEST-xxxxx)',
      amount: 'Amount in IDR (default: 1000)',
      status: 'Transaction status (settlement/pending/deny/cancel/expire)',
    },
    example: '/api/webhook-test?orderId=PBS-1771870369795&amount=1000&status=settlement',
  })
}
