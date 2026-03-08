import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''

// Initialize Supabase with server key for webhook processing
const supabase = createClient(
  supabaseUrl,
  supabaseServerKey
)

function parseAdminIds(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map((id) => id.replace(/['"]/g, '').trim())
    .filter(Boolean)
}

async function sendTelegramToAdmins(text: string, context: string) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const adminIds = parseAdminIds(process.env.TELEGRAM_ADMIN_IDS)

  if (!token || adminIds.length === 0) {
    console.warn(`[${context}] Telegram env missing`, {
      hasToken: Boolean(token),
      adminCount: adminIds.length,
    })
    return
  }

  await Promise.all(
    adminIds.map(async (chatId) => {
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

        if (!resp.ok) {
          const body = await resp.text()
          console.error(`[${context}] Telegram send failed`, {
            chatId,
            status: resp.status,
            body: body.slice(0, 500),
          })
        }
      } catch (err: any) {
        console.error(`[${context}] Telegram request error`, {
          chatId,
          error: err?.message || err,
        })
      }
    })
  )
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServerKey) {
      return NextResponse.json(
        { error: 'Supabase server configuration missing for webhook' },
        { status: 500 }
      )
    }

    const body = await request.json()

    console.log('=== WEBHOOK NOTIFICATION ===')
    console.log('Received:', JSON.stringify(body, null, 2))

    // Verify signature from Midtrans
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const orderId = body.order_id
    const statusCode = body.status_code
    const grossAmount = body.gross_amount
    const signatureKey = body.signature_key

    // Create signature: SHA512(order_id + status_code + gross_amount + SERVER_KEY)
    const rawSignature = orderId + statusCode + grossAmount + serverKey
    const calculatedSignature = crypto
      .createHash('sha512')
      .update(rawSignature)
      .digest('hex')

    console.log('Signature Verification:')
    console.log('  Calculated:', calculatedSignature.substring(0, 20) + '...')
    console.log('  Received:  ', signatureKey.substring(0, 20) + '...')

    if (calculatedSignature !== signatureKey) {
      console.log('❌ Signature verification FAILED!')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    console.log('✅ Signature verification PASSED')

    // Get transaction status
    const transactionStatus = body.transaction_status
    const paymentType = body.payment_type

    console.log(`Transaction Status: ${transactionStatus}`)
    console.log(`Payment Type: ${paymentType}`)

    // Handle different payment statuses
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      // Payment successful
      console.log('✅ PAYMENT SUCCESSFUL!')
      console.log(`Order ${orderId} is PAID`)

      // Update order status in database
      try {
        console.log(`[WEBHOOK] 🔄 Updating order ${orderId} to COMPLETED...`)
        
        const { error: updateError, data: updateData } = await supabase
          .from('orders')
          .update({ 
            status: 'completed',
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)
          .select()

        if (updateError) {
          console.warn('[WEBHOOK] ❌ UPDATE failed:', {
            code: updateError.code,
            message: updateError.message,
          })
        } else {
          console.log('[WEBHOOK] ✅ Order status updated to COMPLETED')
          console.log('[WEBHOOK] Updated rows:', updateData?.length || 0)
        }

        // ========================================
        // FINALIZE PRODUCT ITEMS (Mark as SOLD)
        // ========================================
        console.log(`[WEBHOOK] 🔄 Finalizing product items for order ${orderId}...`)
        
        try {
          // Note: user_id is NULL for web store orders, use 0 as placeholder
          const { data: finalizeResult, error: finalizeError } = await supabase
            .rpc('finalize_items_for_order', {
              p_order_id: orderId,
              p_user_id: 0  // Web store users don't have telegram user_id
            })

          if (finalizeError) {
            console.error('[WEBHOOK] ❌ Finalize items failed:', finalizeError.message)
          } else if (finalizeResult && finalizeResult.ok) {
            console.log(`[WEBHOOK] ✅ Finalized ${finalizeResult.count} items`)
            console.log('[WEBHOOK] Items data:', JSON.stringify(finalizeResult.items, null, 2))
            
            // Check order snapshot for expected quantities
            const { data: orderCheck } = await supabase
              .from('orders')
              .select('items')
              .eq('order_id', orderId)
              .single()
            
            if (orderCheck?.items) {
              const totalExpected = orderCheck.items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
              console.log(`[WEBHOOK] Expected ${totalExpected} total items from order snapshot:`, orderCheck.items)
              if (finalizeResult.count < totalExpected) {
                console.warn(`[WEBHOOK] ⚠️ QUANTITY MISMATCH: Finalized ${finalizeResult.count} but expected ${totalExpected}`)
              }
            }

            // Update order_items table with actual item data
            if (finalizeResult.items && finalizeResult.items.length > 0) {
              // Get order UUID once
              const { data: orderData } = await supabase
                .from('orders')
                .select('id, items')
                .eq('order_id', orderId)
                .single()

              if (!orderData) {
                console.error('[WEBHOOK] ❌ Order not found in database')
              } else {
                for (const finalizedItem of finalizeResult.items) {
                  try {
                    // Find matching product from order.items snapshot
                    const orderItem = orderData.items?.find(
                      (i: any) => i.product_code === finalizedItem.product_code
                    )

                    if (!orderItem) {
                      console.warn(`[WEBHOOK] ⚠️ No matching order item for product_code: ${finalizedItem.product_code}`)
                      continue
                    }

                    console.log(`[WEBHOOK] Saving item ${finalizedItem.product_code} with data:`, finalizedItem.item_data)

                    // Use delete+insert; allow multiple rows per product_code (quantity > 1)
                    await supabase
                      .from('order_items')
                      .delete()
                      .eq('order_id', orderData.id)
                      .is('item_data', null)
                      .eq('product_code', finalizedItem.product_code)

                    const { error: insertError } = await supabase
                      .from('order_items')
                      .insert({
                        order_id: orderData.id,  // UUID
                        product_id: orderItem.product_id || null,  // products table UUID
                        product_code: finalizedItem.product_code,
                        product_name: orderItem.product_name || '',
                        quantity: 1,
                        price: orderItem.price || 0,
                        item_data: finalizedItem.item_data  // CRITICAL: From product_items.item_data
                      })
                    
                    if (insertError) {
                      console.error(`[WEBHOOK] ❌ Failed to save item ${finalizedItem.product_code}:`, insertError)
                    } else {
                      console.log(`[WEBHOOK] ✅ Saved item data to order_items: ${finalizedItem.product_code}`)
                    }
                  } catch (itemErr: any) {
                    console.error('[WEBHOOK] ❌ Exception saving item to order_items:', itemErr.message)
                  }
                }
              }
            }
          } else {
            console.warn('[WEBHOOK] ⚠️ Finalize response:', finalizeResult)
          }
        } catch (finalizeErr: any) {
          console.error('[WEBHOOK] ❌ Exception finalizing items:', finalizeErr.message)
        }
        
      } catch (dbError: any) {
        console.warn('[WEBHOOK] ❌ Database error updating order:', dbError.message)
      }

      // Notify admin about payment
      await notifyAdmin('payment-success', {
        orderId,
        amount: grossAmount,
        paymentType,
        status: transactionStatus,
      })

      return NextResponse.json({ message: 'Payment received' }, { status: 200 })
    } else if (transactionStatus === 'pending') {
      console.log('⏳ PAYMENT PENDING')
      return NextResponse.json({ message: 'Payment pending' }, { status: 200 })
    } else if (
      transactionStatus === 'deny' ||
      transactionStatus === 'cancel' ||
      transactionStatus === 'expire'
    ) {
      console.log('❌ PAYMENT FAILED/CANCELLED')
      console.log(`Order ${orderId} is ${transactionStatus.toUpperCase()}`)

      // Update order status to cancelled
      try {
        await supabase
          .from('orders')
          .update({ 
            status: transactionStatus === 'expire' ? 'expired' : transactionStatus,
          })
          .eq('order_id', orderId)

        // ========================================
        // RELEASE RESERVED ITEMS (back to available)
        // ========================================
        console.log(`[WEBHOOK] 🔄 Releasing reserved items for cancelled order ${orderId}...`)
        
        try {
          const { data: releaseResult, error: releaseError } = await supabase
            .rpc('release_reserved_items', {
              p_order_id: orderId
            })

          if (releaseError) {
            console.error('[WEBHOOK] ❌ Release items failed:', releaseError.message)
          } else if (releaseResult && releaseResult.ok) {
            console.log(`[WEBHOOK] ✅ Released ${releaseResult.count} items back to available`)
          } else {
            console.warn('[WEBHOOK] ⚠️ Release response:', releaseResult)
          }
        } catch (releaseErr: any) {
          console.error('[WEBHOOK] ❌ Exception releasing items:', releaseErr.message)
        }

        await notifyAdmin('payment-cancelled', {
          orderId,
          amount: grossAmount,
          paymentType,
          status: transactionStatus,
        })
        
      } catch (err) {
        console.warn('[WEBHOOK] Failed to update cancelled order:', err)
      }

      return NextResponse.json(
        { message: `Payment ${transactionStatus}` },
        { status: 200 }
      )
    } else if (transactionStatus === 'refund') {
      console.log('💰 REFUND INITIATED')
      // Update order status to refunded
      try {
        await supabase
          .from('orders')
          .update({ status: 'refunded' })
          .eq('order_id', orderId)
      } catch (err) {
        console.warn('[WEBHOOK] Failed to update refunded order:', err)
      }
      return NextResponse.json({ message: 'Refund processed' }, { status: 200 })
    }

    return NextResponse.json({ message: 'OK' }, { status: 200 })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook error' },
      { status: 500 }
    )
  }
}

/**
 * Send notification to admin via Telegram/WhatsApp
 * This connects to your bot-telegram system
 */
async function notifyAdmin(
  type: string,
  data: { orderId: string; amount: string; paymentType: string; status?: string }
) {
  try {
    const message = generateAdminMessage(type, data)
    console.log(`\n📢 ADMIN NOTIFICATION:\n${message}\n`)

    await sendTelegramToAdmins(message, 'WEBHOOK:notify-admin')
  } catch (error) {
    console.error('Failed to notify admin:', error)
  }
}

function generateAdminMessage(
  type: string,
  data: { orderId: string; amount: string; paymentType: string; status?: string }
): string {
  const { orderId, amount, paymentType, status } = data

  if (type === 'payment-success') {
    return `
✅ PEMBAYARAN BERHASIL!
───────────────────────
Order ID: ${orderId}
Amount: Rp ${amount}
Payment: ${paymentType.toUpperCase()}
Status: ${String(status || 'paid').toUpperCase()}

⚠️ ACTION REQUIRED:
1. Cek inventori produk
2. Pack pesanan
3. Update status pengiriman
4. Kirim ke customer
───────────────────────
    `
  }

  if (type === 'payment-cancelled') {
    return `
⌛ ORDER EXPIRED/CANCELLED
───────────────────────
Order ID: ${orderId}
Amount: Rp ${amount}
Payment: ${paymentType.toUpperCase()}
Status: ${String(status || 'cancelled').toUpperCase()}

ℹ️ Stok reserved sudah dirilis kembali.
Silakan follow up customer jika diperlukan.
───────────────────────
    `
  }

  return 'Unknown notification type'
}
