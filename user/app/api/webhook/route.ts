import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase with SERVICE ROLE for webhook (server-side verification)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// ✅ Webhook signature verification
function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string,
  serverKey: string
): boolean {
  const rawSignature = orderId + statusCode + grossAmount + serverKey
  const calculatedSignature = crypto
    .createHash('sha512')
    .update(rawSignature)
    .digest('hex')

  const isValid = calculatedSignature === signatureKey

  console.log('[WEBHOOK] Signature Verification:')
  console.log('  Calculated:', calculatedSignature.substring(0, 20) + '...')
  console.log('  Received:  ', signatureKey.substring(0, 20) + '...')
  console.log('  Result:    ', isValid ? '✅ VALID' : '❌ INVALID')

  return isValid
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()

    console.log('=== 🔔 MIDTRANS WEBHOOK RECEIVED ===')
    console.log('Order ID:', body.order_id)
    console.log('Status:', body.transaction_status)
    console.log('Amount:', body.gross_amount)
    console.log('Time:', new Date().toISOString())

    // ✅ STEP 1: Extract and validate webhook data
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const orderId = String(body.order_id || '').trim()
    const statusCode = String(body.status_code || '').trim()
    const grossAmount = String(body.gross_amount || '').trim()
    const signatureKey = String(body.signature_key || '').trim()
    const transactionStatus = String(body.transaction_status || '').toLowerCase()

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      console.error('[WEBHOOK] ❌ Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // ✅ STEP 2: CRITICAL FIX - Verify signature FIRST
    if (!serverKey) {
      console.error('[WEBHOOK] ❌ MIDTRANS_SERVER_KEY not configured')
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      )
    }

    const isSignatureValid = verifyMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
      signatureKey,
      serverKey
    )

    if (!isSignatureValid) {
      console.error('[WEBHOOK] ❌ TAMPERING DETECTED! Invalid signature for order:', orderId)
      
      // Log suspicious activity
      try {
        await supabase.from('fraud_logs').insert({
          order_id: orderId,
          type: 'invalid_signature',
          webhook_data: body,
          created_at: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('[WEBHOOK] Could not log fraud attempt')
      }

      return NextResponse.json(
        { error: 'Invalid signature - tampering detected' },
        { status: 403 }
      )
    }

    console.log('[WEBHOOK] ✅ Signature verified')

    // ✅ STEP 3: CRITICAL FIX - FETCH ORDER FROM DATABASE AND VALIDATE AMOUNT
    console.log('[WEBHOOK] 📊 Fetching order from database...')

    const { data: dbOrder, error: dbError } = await supabase
      .from('orders')
      .select('id, order_id, total_amount, status')
      .eq('order_id', orderId)
      .single()

    if (dbError || !dbOrder) {
      console.error('[WEBHOOK] ❌ Order not found in DB:', orderId)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    console.log('[WEBHOOK] ✅ Order found in DB')
    console.log('[WEBHOOK] DB total_amount:', dbOrder.total_amount)
    console.log('[WEBHOOK] Midtrans gross_amount:', grossAmount)

    // ✅ STEP 4: VALIDATE AMOUNT MATCHES BEFORE ACCEPTING PAYMENT
    const dbTotal = parseInt(String(dbOrder.total_amount))
    const midtransAmount = parseInt(grossAmount)

    if (isNaN(dbTotal) || isNaN(midtransAmount)) {
      console.error('[WEBHOOK] ❌ Invalid amount format')
      return NextResponse.json(
        { error: 'Invalid amount format' },
        { status: 400 }
      )
    }

    if (midtransAmount !== dbTotal) {
      console.error(
        `[WEBHOOK] ❌ AMOUNT MISMATCH DETECTED!`,
        `Order: ${orderId}`,
        `Expected: Rp${dbTotal}, Received: Rp${midtransAmount}`,
        `Difference: Rp${Math.abs(dbTotal - midtransAmount)}`
      )

      // Log as fraud attempt
      try {
        await supabase.from('fraud_logs').insert({
          order_id: orderId,
          type: 'amount_mismatch',
          expected_amount: dbTotal,
          received_amount: midtransAmount,
          difference: midtransAmount - dbTotal,
          webhook_data: body,
          created_at: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('[WEBHOOK] Could not log fraud')
      }

      // REJECT THIS PAYMENT
      return NextResponse.json(
        { error: 'Amount mismatch - possible tampering' },
        { status: 400 }
      )
    }

    console.log('[WEBHOOK] ✅ Amount verified: Rp' + dbTotal)

    // ✅ STEP 5: HANDLE PAYMENT STATUS
    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      console.log(`[WEBHOOK] ✅ PAYMENT SUCCESSFUL for order ${orderId}`)

      // ✅ Update order status to 'paid'
      try {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)

        if (updateError) {
          console.error('[WEBHOOK] ❌ Could not update order status:', updateError.message)
          return NextResponse.json(
            { error: 'Could not update order' },
            { status: 500 }
          )
        }

        console.log('[WEBHOOK] ✅ Order status updated to "paid"')
      } catch (err: any) {
        console.error('[WEBHOOK] ❌ Exception updating order:', err.message)
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        )
      }

      // ✅ STEP 6: INSERT ITEMS INTO order_items TABLE
      console.log(`[WEBHOOK] 📦 Saving items to order_items for order ${orderId}...`)

      try {
        // ✅ CRITICAL FIX: Fetch order.id (UUID) not order.order_id (string)
        // order_items table has FOREIGN KEY to orders.id (UUID), NOT orders.order_id (string)
        const { data: orderWithItems, error: orderError } = await supabase
          .from('orders')
          .select('id, items')  // ← MUST include id (UUID)
          .eq('order_id', orderId)  // ← Query by order_id string
          .single()

        if (orderError || !orderWithItems) {
          console.error('[WEBHOOK] ❌ Could not fetch order items:', orderError?.message)
          console.error('[WEBHOOK] Error code:', orderError?.code, 'Message:', orderError?.message)
        } else if (orderWithItems.items && Array.isArray(orderWithItems.items) && orderWithItems.items.length > 0) {
          console.log(`[WEBHOOK] ✅ Found ${orderWithItems.items.length} items to save`)
          console.log(`[WEBHOOK] Order UUID: ${orderWithItems.id}`)

          // ✅ CRITICAL: Use orderWithItems.id (UUID) not orderId (string)
          const itemsToInsert = orderWithItems.items.map((item: any) => ({
            order_id: orderWithItems.id,  // ← MUST use UUID id, not string order_id
            product_code: item.product_code,
            product_name: item.product_name,
            price: item.price,
            quantity: item.quantity,
          }))

          console.log('[WEBHOOK] Inserting items with order UUID:', orderWithItems.id)
          console.log('[WEBHOOK] Items payload:', JSON.stringify(itemsToInsert, null, 2))

          // ✅ PROPER error handling - insertResponse includes { data, error, status, statusText, count }
          const insertResponse = await supabase
            .from('order_items')
            .insert(itemsToInsert)

          if (insertResponse.error) {
            console.error('[WEBHOOK] ❌ Failed to insert order_items:')
            console.error('[WEBHOOK]   Code:', insertResponse.error.code)
            console.error('[WEBHOOK]   Message:', insertResponse.error.message)
            console.error('[WEBHOOK]   Details:', insertResponse.error.details)
            console.error('[WEBHOOK]   Hint:', insertResponse.error.hint)
          } else {
            console.log(`[WEBHOOK] ✅ Successfully saved ${itemsToInsert.length} items to order_items table`)
            console.log(`[WEBHOOK] Inserted rows: ${(insertResponse.data as any)?.length || 'unknown count'}`)
          }
        } else {
          console.warn('[WEBHOOK] ⚠️ Order has no items or items is empty/null')
        }
      } catch (err: any) {
        console.error('[WEBHOOK] ❌ Exception saving items:', err.message)
        console.error('[WEBHOOK] Stack:', err.stack)
        // Continue - order is already paid, this is just item tracking
      }

      // Log successful payment
      try {
        await supabase.from('payment_logs').insert({
          order_id: orderId,
          amount: midtransAmount,
          status: 'settlement',
          transaction_id: body.transaction_id,
          created_at: new Date().toISOString(),
        })
      } catch (err) {
        console.warn('[WEBHOOK] Could not log payment')
      }

      const duration = Date.now() - startTime
      console.log(`[WEBHOOK] ✅ PAYMENT PROCESSED SUCCESSFULLY in ${duration}ms`)

      return NextResponse.json({ message: 'Payment processed' }, { status: 200 })

    } else if (transactionStatus === 'pending') {
      console.log(`[WEBHOOK] ⏳ Payment still PENDING for order ${orderId}`)
      return NextResponse.json({ message: 'Payment pending' }, { status: 200 })

    } else if (['deny', 'cancel', 'expire'].includes(transactionStatus)) {
      console.log(`[WEBHOOK] ❌ Payment ${transactionStatus.toUpperCase()} for order ${orderId}`)

      try {
        // Update order status
        await supabase
          .from('orders')
          .update({
            status: transactionStatus === 'expire' ? 'expired' : transactionStatus,
          })
          .eq('order_id', orderId)

        console.log('[WEBHOOK] ✅ Order status updated to', transactionStatus)

        // Release reserved items back to available
        const { data: releaseResult, error: releaseError } = await supabase.rpc(
          'release_reserved_items',
          { p_order_id: orderId }
        )

        if (!releaseError && releaseResult?.ok) {
          console.log(`[WEBHOOK] ✅ Released ${releaseResult.count} items back to available`)
        }
      } catch (err: any) {
        console.error('[WEBHOOK] ❌ Error handling cancellation:', err.message)
      }

      return NextResponse.json(
        { message: `Payment ${transactionStatus}` },
        { status: 200 }
      )

    } else if (transactionStatus === 'refund') {
      console.log(`[WEBHOOK] 💰 REFUND INITIATED for order ${orderId}`)

      try {
        await supabase
          .from('orders')
          .update({ status: 'refunded' })
          .eq('order_id', orderId)

        console.log('[WEBHOOK] ✅ Order marked as refunded')
      } catch (err: any) {
        console.error('[WEBHOOK] ❌ Error handling refund:', err.message)
      }

      return NextResponse.json({ message: 'Refund processed' }, { status: 200 })
    }

    console.log('[WEBHOOK] ⚠️ Unknown transaction status:', transactionStatus)
    return NextResponse.json({ message: 'OK' }, { status: 200 })

  } catch (error: any) {
    console.error('[WEBHOOK] ❌ CRITICAL ERROR:', error.message)
    console.error('[WEBHOOK] Stack:', error.stack)
    return NextResponse.json(
      { error: 'Webhook processing error' },
      { status: 500 }
    )
  }
}
