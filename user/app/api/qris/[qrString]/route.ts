import { NextRequest, NextResponse } from 'next/server'

/**
 * ✅ PROXY ENDPOINT untuk QR Code dari Midtrans
 * Menggunakan transaction_id untuk fetch QR dari Midtrans API
 * Browser tidak bisa direct karena butuh Basic Auth
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { qrString: string } }
) {
  // Note: Parameter name is "qrString" tapi sebenarnya isinya transaction_id
  const transactionId = params.qrString

  try {
    console.log('[QRIS PROXY] Fetching QR for transaction:', transactionId)

    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'

    if (!serverKey) {
      console.error('[QRIS PROXY] ❌ Midtrans credentials missing')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // ✅ Create Basic Auth header
    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    
    // ✅ CORRECT Midtrans endpoint: /v2/{transaction_id}/qr-code (not /qr.png!)
    const qrisUrl = `${apiBase}/v2/qris/${transactionId}/qr-code`

    console.log('[QRIS PROXY] API Base:', apiBase)
    console.log('[QRIS PROXY] Fetching from:', qrisUrl)

    // ✅ Fetch dari Midtrans dengan auth
    const response = await fetch(qrisUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'image/png',
      },
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[QRIS PROXY] ❌ Midtrans error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody.substring(0, 200)
      })
      
      // Return fallback or error
      return NextResponse.json(
        { error: 'QR not found', status: response.status },
        { status: response.status }
      )
    }

    // ✅ Get image data
    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    console.log('[QRIS PROXY] ✅ QR fetched, size:', imageBuffer.byteLength, 'bytes')

    // ✅ Return image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 hour
        'Content-Length': String(imageBuffer.byteLength),
      },
    })

  } catch (error) {
    console.error('[QRIS PROXY] ❌ Error:', (error as Error).message)
    return NextResponse.json(
      { error: 'Failed to fetch QR code' },
      { status: 500 }
    )
  }
}
