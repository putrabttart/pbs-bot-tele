import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  sendOrderDeliveryEmailWithRetry,
} from '@/lib/email/smtp-delivery'
import type { OrderDeliveryEmailPayload } from '@/lib/email/order-delivery-template'

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
            if (attempt > 1) {
              console.log(`[${context}] Telegram send recovered`, { chatId, attempt })
            }
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

      console.error(`[${context}] Telegram send failed`, {
        chatId,
        error: lastError || 'unknown_error',
      })
    })
  )
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const normalized = String(status || '').toLowerCase()
  return ['completed', 'paid', 'settlement', 'capture', 'success'].includes(normalized)
}

function isFailedStatus(status: string | null | undefined): boolean {
  const normalized = String(status || '').toLowerCase()
  return ['expired', 'expire', 'cancel', 'cancelled', 'deny', 'denied', 'failed'].includes(normalized)
}

function normalizeFailedStatusForNotification(status: string | null | undefined): string {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'cancelled') return 'cancel'
  if (normalized === 'expired') return 'expire'
  if (normalized === 'denied') return 'deny'
  if (normalized === 'failure') return 'failed'
  return normalized
}

function resolveOrderSource(orderRow: any): 'TELEGRAM BOT' | 'WEBSITE' {
  const userRef = String(orderRow?.user_ref || '').toLowerCase()
  if (userRef.startsWith('tg:')) return 'TELEGRAM BOT'
  if (orderRow?.user_id !== null && orderRow?.user_id !== undefined) return 'TELEGRAM BOT'
  return 'WEBSITE'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeErrorMessage(error: unknown, maxLength = 500) {
  const raw = String(error || 'unknown_error').replace(/\s+/g, ' ').trim()
  if (!raw) return 'unknown_error'
  return raw.length > maxLength ? raw.slice(0, maxLength) : raw
}

async function claimOrderEmailDelivery(orderId: string) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        delivery_email_status: 'processing',
        delivery_email_last_attempt_at: new Date().toISOString(),
        delivery_email_last_error: null,
      })
      .eq('order_id', orderId)
      .eq('status', 'completed')
      .in('delivery_email_status', ['pending', 'failed'])
      .select('order_id, customer_email, delivery_email_attempts')
      .maybeSingle()

    if (error) {
      console.warn('[WEBHOOK] Failed to claim order email delivery:', {
        orderId,
        code: error.code,
        message: error.message,
      })
      return { claimed: false as const, error: error.message }
    }

    if (!data) {
      return { claimed: false as const }
    }

    return {
      claimed: true as const,
      order: data,
    }
  } catch (err: any) {
    const errorMessage = normalizeErrorMessage(err?.message || err)
    console.warn('[WEBHOOK] Exception while claiming order email delivery:', {
      orderId,
      error: errorMessage,
    })
    return { claimed: false as const, error: errorMessage }
  }
}

function combineOrderItemsByProductCode(orderItems: any[] = []) {
  const map: Record<string, any> = {}

  for (const item of orderItems) {
    const code = String(item?.product_code || '')
    if (!code) continue

    if (!map[code]) {
      map[code] = {
        product_code: code,
        product_name: item?.product_name || code,
        quantity: Number(item?.quantity || 1),
        price: Number(item?.price || 0),
        item_data: String(item?.item_data || ''),
      }
      continue
    }

    const previousItemData = String(map[code].item_data || '')
    const nextItemData = String(item?.item_data || '')
    map[code] = {
      ...map[code],
      quantity: Number(item?.quantity || map[code].quantity || 1),
      price: Number(item?.price || map[code].price || 0),
      item_data: [previousItemData, nextItemData].filter(Boolean).join('\n'),
    }
  }

  return map
}

async function buildOrderDeliveryEmailPayload(orderId: string): Promise<{
  payload: OrderDeliveryEmailPayload | null
  hasDeliverableItems: boolean
  error?: string
}> {
  try {
    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id, order_id, customer_name, customer_email, total_amount, paid_at, created_at, items')
      .eq('order_id', orderId)
      .maybeSingle()

    if (orderError || !orderRow) {
      return {
        payload: null,
        hasDeliverableItems: false,
        error: orderError?.message || 'order_not_found',
      }
    }

    const snapshotItems = Array.isArray(orderRow.items)
      ? orderRow.items.map((item: any) => ({
          product_code: String(item?.product_code || ''),
          product_name: String(item?.product_name || item?.product_code || ''),
          quantity: Number(item?.quantity || 1),
          price: Number(item?.price || 0),
          item_data: '',
        }))
      : []

    const { data: orderItemsRows, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_code, product_name, quantity, price, item_data')
      .eq('order_id', orderRow.id)

    if (orderItemsError) {
      return {
        payload: null,
        hasDeliverableItems: false,
        error: orderItemsError.message,
      }
    }

    const combinedOrderItems = combineOrderItemsByProductCode(orderItemsRows || [])

    let mergedItems = snapshotItems.map((snapshotItem: any) => {
      const fulfilled = combinedOrderItems[snapshotItem.product_code]
      return fulfilled ? { ...snapshotItem, ...fulfilled } : snapshotItem
    })

    for (const combinedItem of Object.values(combinedOrderItems)) {
      const code = String((combinedItem as any)?.product_code || '')
      if (!code) continue

      const alreadyExists = mergedItems.some((item: any) => item.product_code === code)
      if (!alreadyExists) {
        mergedItems.push(combinedItem)
      }
    }

    const { data: notesRows, error: notesError } = await supabase
      .from('product_items')
      .select('product_code, notes')
      .eq('order_id', orderId)
      .eq('status', 'sold')

    if (notesError) {
      console.warn('[WEBHOOK] Failed to load product notes for email payload:', {
        orderId,
        message: notesError.message,
      })
    }

    const notesMap = new Map<string, string[]>()
    for (const row of notesRows || []) {
      const code = String(row?.product_code || '').trim()
      const note = String(row?.notes || '').trim()
      if (!code || !note) continue

      const current = notesMap.get(code) || []
      if (!current.includes(note)) {
        current.push(note)
      }
      notesMap.set(code, current)
    }

    mergedItems = mergedItems.map((item: any) => ({
      ...item,
      product_notes: (notesMap.get(String(item?.product_code || '')) || []).join('\n'),
    }))

    const emailItems = mergedItems.map((item: any) => ({
      productName: String(item?.product_name || item?.product_code || '-'),
      productCode: String(item?.product_code || '-'),
      quantity: Number(item?.quantity || 1),
      price: Number(item?.price || 0),
      itemData: String(item?.item_data || ''),
      productNotes: String(item?.product_notes || ''),
    }))

    const hasDeliverableItems = emailItems.some((item) => Boolean(String(item.itemData || '').trim()))

    const payload: OrderDeliveryEmailPayload = {
      orderId: String(orderRow.order_id || orderId),
      customerName: String(orderRow.customer_name || ''),
      customerEmail: normalizeCustomerEmail(String(orderRow.customer_email || '')),
      transactionTime: String(orderRow.paid_at || orderRow.created_at || ''),
      totalAmount: Number(orderRow.total_amount || 0),
      items: emailItems,
    }

    return {
      payload,
      hasDeliverableItems,
    }
  } catch (err: any) {
    return {
      payload: null,
      hasDeliverableItems: false,
      error: normalizeErrorMessage(err?.message || err),
    }
  }
}

async function updateOrderEmailDeliveryState(
  orderId: string,
  nextState: {
    status: 'sent' | 'failed'
    attempts: number
    lastError?: string
  }
) {
  const updatePayload: Record<string, any> = {
    delivery_email_status: nextState.status,
    delivery_email_attempts: nextState.attempts,
    delivery_email_last_attempt_at: new Date().toISOString(),
    delivery_email_last_error: nextState.lastError || null,
  }

  if (nextState.status === 'sent') {
    updatePayload.delivery_email_sent_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('order_id', orderId)

  if (error) {
    console.warn('[WEBHOOK] Failed to update order email delivery state:', {
      orderId,
      code: error.code,
      message: error.message,
      nextState,
    })
  }
}

async function sendOrderDeliveryEmailForPaidOrder(orderId: string) {
  const claim = await claimOrderEmailDelivery(orderId)

  if (!claim.claimed) {
    if (claim.error) {
      console.warn('[WEBHOOK] Skip customer delivery email due to claim error:', {
        orderId,
        error: claim.error,
      })
    } else {
      console.log('[WEBHOOK] Skip customer delivery email (already sent or being processed):', {
        orderId,
      })
    }
    return
  }

  const previousAttempts = Number(claim.order.delivery_email_attempts || 0)
  const customerEmail = normalizeCustomerEmail(String(claim.order.customer_email || ''))

  if (!isValidCustomerEmail(customerEmail)) {
    await updateOrderEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastError: 'invalid_customer_email',
    })
    console.warn('[WEBHOOK] Invalid customer email, skip sending order delivery email:', {
      orderId,
      customerEmail,
    })
    return
  }

  let payloadResult = await buildOrderDeliveryEmailPayload(orderId)

  if (!payloadResult.payload || !payloadResult.hasDeliverableItems) {
    // Give database writes a short window to settle after finalization.
    for (let retry = 0; retry < 2 && (!payloadResult.payload || !payloadResult.hasDeliverableItems); retry += 1) {
      await sleep(750 * (retry + 1))
      payloadResult = await buildOrderDeliveryEmailPayload(orderId)
    }
  }

  if (!payloadResult.payload) {
    const payloadError = normalizeErrorMessage(payloadResult.error || 'failed_build_email_payload')
    await updateOrderEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastError: payloadError,
    })
    console.warn('[WEBHOOK] Failed to build order delivery email payload:', {
      orderId,
      error: payloadError,
    })
    return
  }

  if (!payloadResult.hasDeliverableItems) {
    await updateOrderEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastError: 'delivery_items_not_ready',
    })
    console.warn('[WEBHOOK] Delivery items not ready, email not sent:', { orderId })
    return
  }

  const sendResult = await sendOrderDeliveryEmailWithRetry({
    ...payloadResult.payload,
    customerEmail,
  })

  const totalAttempts = previousAttempts + Math.max(1, Number(sendResult.attempts || 1))

  if (sendResult.ok) {
    await updateOrderEmailDeliveryState(orderId, {
      status: 'sent',
      attempts: totalAttempts,
    })
    console.log('[WEBHOOK] Customer delivery email sent successfully:', {
      orderId,
      attempts: sendResult.attempts,
      messageId: sendResult.messageId,
    })
    return
  }

  await updateOrderEmailDeliveryState(orderId, {
    status: 'failed',
    attempts: totalAttempts,
    lastError: normalizeErrorMessage(sendResult.error || 'delivery_email_send_failed'),
  })

  console.error('[WEBHOOK] Customer delivery email failed:', {
    orderId,
    attempts: sendResult.attempts,
    error: sendResult.error,
    nonRetryable: sendResult.nonRetryable,
  })
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

    // Load existing order metadata for source and idempotency decisions
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('status, user_ref, user_id')
      .eq('order_id', orderId)
      .maybeSingle()

    const orderSource = resolveOrderSource(existingOrder)
    const previousStatus = String(existingOrder?.status || '').toLowerCase()

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

      if (orderSource !== 'TELEGRAM BOT') {
        await sendOrderDeliveryEmailForPaidOrder(orderId)
      } else {
        console.log('[WEBHOOK] Skip customer delivery email for Telegram bot source', { orderId })
      }

      const shouldNotifyAdmin = !isCompletedStatus(previousStatus) && orderSource !== 'TELEGRAM BOT'
      if (shouldNotifyAdmin) {
        await notifyAdmin('payment-success', {
          orderId,
          amount: grossAmount,
          paymentType,
          status: transactionStatus,
          source: orderSource,
        })
      } else {
        console.log('[WEBHOOK] Skip admin success notification (already terminal or handled by Telegram bot)', {
          orderId,
          previousStatus,
          source: orderSource,
        })
      }

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

        const shouldNotifyAdmin =
          orderSource !== 'TELEGRAM BOT' &&
          normalizeFailedStatusForNotification(previousStatus) !==
            normalizeFailedStatusForNotification(transactionStatus)
        if (shouldNotifyAdmin) {
          await notifyAdmin('payment-cancelled', {
            orderId,
            amount: grossAmount,
            paymentType,
            status: transactionStatus,
            source: orderSource,
          })
        } else {
          console.log('[WEBHOOK] Skip admin failed notification (already terminal or handled by Telegram bot)', {
            orderId,
            previousStatus,
            source: orderSource,
          })
        }
        
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
  data: { orderId: string; amount: string; paymentType: string; status?: string; source?: string }
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
  data: { orderId: string; amount: string; paymentType: string; status?: string; source?: string }
): string {
  const { orderId, amount, paymentType, status, source } = data
  const sourceLine = `Sumber: ${String(source || 'WEBSITE').toUpperCase()}`

  if (type === 'payment-success') {
    return `
✅ PEMBAYARAN BERHASIL!
───────────────────────
${sourceLine}
Order ID: ${orderId}
Amount: Rp ${amount}
Payment: ${paymentType.toUpperCase()}
Status: ${String(status || 'paid').toUpperCase()}

ℹ️ Produk diproses auto-delivery.
───────────────────────
    `
  }

  if (type === 'payment-cancelled') {
    return `
⌛ ORDER EXPIRED/CANCELLED
───────────────────────
${sourceLine}
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
