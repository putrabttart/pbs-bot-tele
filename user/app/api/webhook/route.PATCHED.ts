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

      // ✅ STEP 6: FINALIZE PRODUCT ITEMS (only after amount verified!)
      console.log(`[WEBHOOK] 📦 Finalizing items for order ${orderId}...`)

      try {
        const { data: finalizeResult, error: finalizeError } = await supabase.rpc(
          'finalize_items_for_order',
          {
            p_order_id: orderId,
            p_user_id: 0, // Web store users
          }
        )

        if (finalizeError) {
          console.error('[WEBHOOK] ❌ Finalize failed:', finalizeError.message)
          return NextResponse.json(
            { error: 'Could not finalize items' },
            { status: 500 }
          )
        }

        if (finalizeResult?.ok) {
          console.log(`[WEBHOOK] ✅ Finalized ${finalizeResult.count} items`)
          console.log('[WEBHOOK] Items marked as SOLD')

          // Verify quantity matches order snapshot
          const { data: orderCheck } = await supabase
            .from('orders')
            .select('items')
            .eq('order_id', orderId)
            .single()

          if (orderCheck?.items) {
            const expectedQty = orderCheck.items.reduce(
              (sum: number, i: any) => sum + (i.quantity || 0),
              0
            )
            console.log(
              `[WEBHOOK] Quantity check: Finalized ${finalizeResult.count} of ${expectedQty}`
            )

            if (finalizeResult.count < expectedQty) {
              console.warn(
                `[WEBHOOK] ⚠️ Qty mismatch: Expected ${expectedQty}, got ${finalizeResult.count}`
              )
            }
          }

          // Store finalized items in order_items table
          if (finalizeResult.items && finalizeResult.items.length > 0) {
            console.log('[WEBHOOK] 💾 Saving item data to order_items...')

            const { data: orderData } = await supabase
              .from('orders')
              .select('id')
              .eq('order_id', orderId)
              .single()

            if (orderData) {
              for (const finalizedItem of finalizeResult.items) {
                try {
                  const { error: insertError } = await supabase
                    .from('order_items')
                    .insert({
                      order_id: orderData.id,
                      product_code: finalizedItem.product_code,
                      item_data: finalizedItem.item_data,
                      quantity: 1,
                      created_at: new Date().toISOString(),
                    })

                  if (!insertError) {
                    console.log(`[WEBHOOK] ✅ Saved item: ${finalizedItem.product_code}`)
                  }
                } catch (err: any) {
                  console.error(`[WEBHOOK] ❌ Error saving item:`, err.message)
                }
              }
            }
          }
        } else {
          console.error('[WEBHOOK] ❌ Finalize returned error:', finalizeResult?.msg)
        }
      } catch (finalizeErr: any) {
        console.error('[WEBHOOK] ❌ Exception during finalization:', finalizeErr.message)
        // Don't fail the whole webhook, just log
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
