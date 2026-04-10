import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  sendOrderDeliveryEmailWithRetry,
} from '@/lib/email/smtp-delivery'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const normalizeStatus = (status?: string) => {
  if (!status) return 'pending'
  const s = status.toLowerCase()
  if (['completed', 'success', 'settlement', 'capture'].includes(s)) return 'completed'
  if (['pending', 'pending_payment', 'waiting_payment'].includes(s)) return 'pending'
  if (['expire', 'expired', 'cancel', 'denied', 'deny', 'failed', 'failure'].includes(s)) return 'failed'
  return status
}

const hasNonEmptyItemData = (value: unknown) => String(value || '').trim().length > 0

const attachProductNotes = async (items: any[] = [], orderId?: string) => {
  try {
    if (!items || items.length === 0) return items
    if (!orderId) return items

    const codes = Array.from(
      new Set(
        items
          .map((it) => it.product_code)
          .filter(Boolean)
      )
    )

    if (codes.length === 0) return items

    const { data, error } = await supabase
      .from('product_items')
      .select('product_code, notes, item_data')
      .eq('order_id', orderId)
      .eq('status', 'sold')
      .in('product_code', codes)

    if (error) {
      console.warn('[Order Details] Failed to fetch product item notes:', error.message)
      return items
    }

    const notesMap = new Map<string, string[]>()
    for (const row of data || []) {
      const code = row.product_code
      const note = (row.notes || '').trim()
      if (!code || !note) continue
      const list = notesMap.get(code) || []
      if (!list.includes(note)) list.push(note)
      notesMap.set(code, list)
    }

    return items.map((it) => ({
      ...it,
      product_notes: (notesMap.get(it.product_code) || []).join('\n'),
    }))
  } catch (err: any) {
    console.warn('[Order Details] Product notes error:', err?.message || err)
    return items
  }
}

const normalizeErrorMessage = (error: unknown, maxLength = 500) => {
  const raw = String(error || 'unknown_error').replace(/\s+/g, ' ').trim()
  if (!raw) return 'unknown_error'
  return raw.length > maxLength ? raw.slice(0, maxLength) : raw
}

const claimOrderDetailsEmailDelivery = async (orderId: string) => {
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
      .select('order_id, delivery_email_attempts')
      .maybeSingle()

    if (error) {
      return { claimed: false as const, error: error.message }
    }

    if (!data) {
      return { claimed: false as const }
    }

    return {
      claimed: true as const,
      attempts: Number(data.delivery_email_attempts || 0),
    }
  } catch (err: any) {
    return {
      claimed: false as const,
      error: normalizeErrorMessage(err?.message || err),
    }
  }
}

const updateOrderDetailsEmailDeliveryState = async (
  orderId: string,
  nextState: {
    status: 'sent' | 'failed'
    attempts: number
    lastError?: string
  }
) => {
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
    console.warn('[Order Details] Failed updating email delivery state:', {
      orderId,
      message: error.message,
      nextState,
    })
  }
}

const maybeSendCustomerDeliveryEmailFromOrderDetails = async (
  orderData: any,
  itemsWithNotes: any[],
  responseStatus: string
) => {
  if (responseStatus !== 'completed') return

  const hasDeliverableItems = (itemsWithNotes || []).some((item: any) => Boolean(String(item?.item_data || '').trim()))
  if (!hasDeliverableItems) return

  const orderId = String(orderData?.order_id || '').trim()
  if (!orderId) return

  const claim = await claimOrderDetailsEmailDelivery(orderId)
  if (!claim.claimed) {
    if (claim.error) {
      console.warn('[Order Details] Email delivery claim skipped with error:', {
        orderId,
        error: claim.error,
      })
    }
    return
  }

  const previousAttempts = Number(claim.attempts || 0)
  const customerEmail = normalizeCustomerEmail(String(orderData?.customer_email || ''))

  if (!isValidCustomerEmail(customerEmail)) {
    await updateOrderDetailsEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastError: 'invalid_customer_email',
    })
    console.warn('[Order Details] Invalid customer email for delivery copy:', {
      orderId,
      customerEmail,
    })
    return
  }

  const payload = {
    orderId,
    customerName: String(orderData?.customer_name || ''),
    customerEmail,
    transactionTime: String(orderData?.paid_at || orderData?.created_at || ''),
    totalAmount: Number(orderData?.total_amount || 0),
    items: (itemsWithNotes || []).map((item: any) => ({
      productName: String(item?.product_name || item?.product_code || '-'),
      productCode: String(item?.product_code || '-'),
      quantity: Number(item?.quantity || 1),
      price: Number(item?.price || 0),
      itemData: String(item?.item_data || ''),
      productNotes: String(item?.product_notes || ''),
    })),
  }

  const sendResult = await sendOrderDeliveryEmailWithRetry(payload)
  const totalAttempts = previousAttempts + Math.max(1, Number(sendResult.attempts || 1))

  if (sendResult.ok) {
    await updateOrderDetailsEmailDeliveryState(orderId, {
      status: 'sent',
      attempts: totalAttempts,
    })
    console.log('[Order Details] ✅ Delivery email sent from fallback path:', {
      orderId,
      attempts: sendResult.attempts,
      messageId: sendResult.messageId,
    })
    return
  }

  await updateOrderDetailsEmailDeliveryState(orderId, {
    status: 'failed',
    attempts: totalAttempts,
    lastError: normalizeErrorMessage(sendResult.error || 'delivery_email_send_failed'),
  })

  console.warn('[Order Details] Delivery email failed from fallback path:', {
    orderId,
    attempts: sendResult.attempts,
    error: sendResult.error,
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required' },
        { status: 400 }
      )
    }

    console.log('[Order Details] Getting order from database:', orderId)

    // Get order from database
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (dbError || !orderData) {
      console.warn('[Order Details] Order not found in database:', dbError)
      
      // Fallback: Get from Midtrans if not in database
      return await getFromMidtrans(orderId)
    }

    console.log('[Order Details] Order found in database:', orderData)

    // Get fulfilled items (with item_data) if available
    const { data: orderItemsData, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_code, product_name, quantity, price, item_data')
      .eq('order_id', orderData.id)

    if (orderItemsError) {
      console.warn('[Order Details] Could not load order_items:', orderItemsError.message)
    }

    // Helper: combine multiple rows per product_code (join item_data)
    const combineByProductCode = (items: any[] = []) => {
      const map: Record<string, any> = {}
      for (const it of items) {
        const code = it.product_code
        if (!map[code]) {
          map[code] = { ...it }
        } else {
          const prev = map[code]
          map[code] = {
            ...prev,
            // keep quantity/price/name from snapshot later; here only merge item_data
            item_data: [prev.item_data, it.item_data].filter(Boolean).join('\n')
          }
        }
      }
      return map
    }

    // Merge order snapshot with fulfilled items so item_data ikut terpakai jika ada
    const snapshotItems = (orderData.items || []).map((i: any) => ({
      product_code: i.product_code,
      product_name: i.product_name,
      quantity: i.quantity,
      price: i.price,
      item_data: undefined,
    }))

    let itemsPayload = snapshotItems
    if (orderItemsData && orderItemsData.length > 0) {
      const combined = combineByProductCode(orderItemsData)
      itemsPayload = snapshotItems.map((snap: any) => {
        const fulfilled = combined[snap.product_code]
        return fulfilled ? { ...snap, ...fulfilled } : snap
      })

      for (const combinedItem of Object.values(combined)) {
        const code = String((combinedItem as any)?.product_code || '')
        if (!code) continue
        const exists = itemsPayload.some((it: any) => String(it?.product_code || '') === code)
        if (!exists) {
          itemsPayload.push(combinedItem)
        }
      }
    }

    const normalizedDbStatus: string = normalizeStatus(orderData.status)

    // FALLBACK: If status still pending after 30s, check Midtrans directly and update DB if paid
    if (normalizedDbStatus === 'pending') {
      const createdAt = new Date(orderData.created_at).getTime()
      const now = Date.now()
      const elapsedSeconds = (now - createdAt) / 1000

      if (elapsedSeconds > 30) {
        console.log(`[Order Details] Order pending for ${Math.round(elapsedSeconds)}s, checking Midtrans...`)
        const midtransCheck = await getFromMidtransRaw(orderId)
        
        if (midtransCheck.success) {
          const mtStatus = normalizeStatus(midtransCheck.status)
          console.log(`[Order Details] Midtrans status: ${midtransCheck.status} -> ${mtStatus}`)
          
          if (mtStatus === 'completed') {
            console.log('[Order Details] 🔄 Syncing status from Midtrans to database...')

            const paidAt = orderData.paid_at || new Date().toISOString()
            
            // Update database
            const { data: updatedRows, error: updateError } = await supabase
              .from('orders')
              .update({ 
                status: 'completed',
                paid_at: paidAt,
              })
              .eq('order_id', orderId)
              .eq('status', 'pending')
              .select('id')

            if (updateError) {
              console.error('[Order Details] Failed to update status:', updateError)
            } else if (!updatedRows || updatedRows.length === 0) {
              console.log('[Order Details] Status already synced by another process, skip fallback finalization')
            } else {
              console.log('[Order Details] ✅ Status updated to completed')
              
              // Trigger finalization
              try {
                const { data: finalizeResult } = await supabase
                  .rpc('finalize_items_for_order', {
                    p_order_id: orderId,
                    p_user_id: 0
                  })
                if (finalizeResult?.ok) {
                  console.log(`[Order Details] ✅ Finalized ${finalizeResult.count} items`)
                }
              } catch (e) {
                console.error('[Order Details] Finalize error:', e)
              }
              
              // Re-fetch to get updated order
              const { data: updatedOrder } = await supabase
                .from('orders')
                .select('*')
                .eq('order_id', orderId)
                .single()
              
              if (updatedOrder) {
                Object.assign(orderData, updatedOrder)
              }
            }
          }
        }
      }
    }

    // If status is completed but no item_data, try to populate from product_items
    if (normalizeStatus(orderData.status) === 'completed') {
      const itemsWithData = itemsPayload.filter((item: any) => hasNonEmptyItemData(item.item_data))
      
      if (itemsWithData.length === 0) {
        console.log('[Order Details] ⚠️ Completed order without item_data in order_items, attempting finalization...')
        
        // Check if items already exist in order_items with data to prevent re-finalization loop
        const { data: existingItems, error: checkError } = await supabase
          .from('order_items')
          .select('product_code, item_data')
          .eq('order_id', orderData.id)
          .not('item_data', 'is', null)

        const existingItemsWithData = (existingItems || []).filter((item: any) => hasNonEmptyItemData(item?.item_data))

        if (!checkError && existingItemsWithData.length > 0) {
          console.log('[Order Details] ✅ Items already exist in order_items, using those')
          // Merge existing items into payload
          const combined = combineByProductCode(existingItemsWithData)
          itemsPayload = snapshotItems.map((snap: any) => {
            const fulfilled = combined[snap.product_code]
            return fulfilled ? { ...snap, ...fulfilled } : snap
          })

          for (const combinedItem of Object.values(combined)) {
            const code = String((combinedItem as any)?.product_code || '')
            if (!code) continue
            const exists = itemsPayload.some((it: any) => String(it?.product_code || '') === code)
            if (!exists) {
              itemsPayload.push(combinedItem)
            }
          }
        } else {
          // Only run finalization if no items with data exist
          console.log('[Order Details] 🔄 Starting finalization process...')
          try {
            // First, try finalize (for reserved items)
            console.log('[Order Details] Step 1: Calling finalize_items_for_order RPC...')
            const { data: finalizeResult, error: finalizeError } = await supabase
              .rpc('finalize_items_for_order', {
                p_order_id: orderId,
                p_user_id: 0
              })

            if (finalizeError) {
              console.error('[Order Details] ❌ Finalize RPC error:', finalizeError)
            } else {
              console.log('[Order Details] Finalize RPC result:', finalizeResult)
            }

            let itemsToSave: any[] = []

            if (!finalizeError && finalizeResult?.ok && finalizeResult.items?.length > 0) {
              console.log(`[Order Details] ✅ Finalized ${finalizeResult.count} reserved items`)
              itemsToSave = finalizeResult.items
            } else {
              // If finalize fails (items already sold), fetch sold items directly from product_items
              console.log('[Order Details] Step 2: Fetching sold items from product_items table...')
              
              const productCodes = (orderData.items || []).map((i: any) => i.product_code)
              console.log('[Order Details] Looking for product codes:', productCodes)
              
              const { data: soldItems, error: soldError } = await supabase
                .from('product_items')
                .select('id, product_code, item_data')
                .eq('order_id', orderId)
                .eq('status', 'sold')
                .in('product_code', productCodes)

              if (soldError) {
                console.error('[Order Details] ❌ Sold items query error:', soldError)
              } else {
                console.log('[Order Details] Sold items query result:', { count: soldItems?.length, items: soldItems })
              }

              if (!soldError && soldItems && soldItems.length > 0) {
                console.log(`[Order Details] ✅ Found ${soldItems.length} sold items`)
                itemsToSave = soldItems
              } else {
                console.warn('[Order Details] ⚠️ No sold items found for order')
              }
            }

            // Save items to order_items table (only if not already saved)
            if (itemsToSave.length > 0) {
              console.log(`[Order Details] Step 3: Saving ${itemsToSave.length} items to order_items...`)
              console.log('[Order Details] itemsToSave details:', JSON.stringify(itemsToSave, null, 2))
              let savedCount = 0
              
              for (const item of itemsToSave) {
                const orderItem = (orderData.items || []).find((i: any) => i.product_code === item.product_code)

                if (!orderItem) {
                  console.warn(`[Order Details] No matching snapshot item for product_code: ${item.product_code}, using fallback values`)
                }

                const fallbackOrderItem = orderItem || {
                  product_id: null,
                  product_name: item.product_code || 'Item Digital',
                  price: 0,
                }

                // Check if this specific item_data already exists
                const { data: dupCheck } = await supabase
                  .from('order_items')
                  .select('id')
                  .eq('order_id', orderData.id)
                  .eq('product_code', item.product_code)
                  .eq('item_data', item.item_data)
                  .maybeSingle()

                if (dupCheck) {
                  console.log(`[Order Details] Item ${item.product_code}/${item.item_data} already exists, skipping`)
                  savedCount++
                  continue
                }

                console.log(`[Order Details] Inserting item ${item.product_code}: ${item.item_data}`)

                const { error: insertError } = await supabase
                  .from('order_items')
                  .insert({
                    order_id: orderData.id,
                    product_id: fallbackOrderItem.product_id || null,
                    product_code: item.product_code,
                    product_name: fallbackOrderItem.product_name || item.product_code || '',
                    quantity: 1,
                    price: fallbackOrderItem.price || 0,
                    item_data: item.item_data
                  })

                if (insertError) {
                  console.error(`[Order Details] ❌ Insert error for ${item.product_code}:`, insertError)
                } else {
                  console.log(`[Order Details] ✅ Inserted item ${item.product_code}`)
                  savedCount++
                }
              }

              console.log(`[Order Details] Saved ${savedCount}/${itemsToSave.length} items, waiting 500ms for DB...`)

              // Wait longer to ensure DB commit
              await new Promise(resolve => setTimeout(resolve, 500))

              // Step 4: Refresh to verify
              console.log(`[Order Details] Step 4: Refreshing order_items to verify...`)
              const { data: refreshedItems, error: refreshError } = await supabase
                .from('order_items')
                .select('product_code, product_name, quantity, price, item_data')
                .eq('order_id', orderData.id)

              if (refreshError) {
                console.error('[Order Details] ❌ Refresh query error:', refreshError)
              } else {
                console.log(`[Order Details] Refresh found ${refreshedItems?.length || 0} items:`, refreshedItems)
                
                if (refreshedItems && refreshedItems.length > 0) {
                  const combined = combineByProductCode(refreshedItems)
                  itemsPayload = snapshotItems.map((snap: any) => {
                    const fulfilled = combined[snap.product_code]
                    return fulfilled ? { ...snap, ...fulfilled } : snap
                  })

                  for (const combinedItem of Object.values(combined)) {
                    const code = String((combinedItem as any)?.product_code || '')
                    if (!code) continue
                    const exists = itemsPayload.some((it: any) => String(it?.product_code || '') === code)
                    if (!exists) {
                      itemsPayload.push(combinedItem)
                    }
                  }

                  console.log('[Order Details] ✅ itemsPayload updated successfully')
                } else {
                  console.warn('[Order Details] ⚠️ Refresh returned 0 items')
                }
              }
            } else {
              console.warn('[Order Details] itemsToSave is empty, nothing to save')
            }
          } catch (err: any) {
            console.error('[Order Details] ❌ Finalization exception:', err.message, err)
          }
        }
      } else {
        console.log(`[Order Details] ✅ Found ${itemsWithData.length} items with data, ready to return`)
      }
      
      // CRITICAL: Check if items are ready before returning status
      const finalItemsWithData = itemsPayload.filter((item: any) => hasNonEmptyItemData(item.item_data))
      const finalStatus = finalItemsWithData.length > 0 ? normalizedDbStatus : 'processing'
      
      if (finalItemsWithData.length === 0) {
        console.log('[Order Details] ⚠️ Still no items after finalization attempt, returning "processing"')
      } else {
        console.log(`[Order Details] ✅ Ready to return with ${finalItemsWithData.length} items`)
      }
      
      // Return completed order only if items are ready
      const itemsWithNotes = await attachProductNotes(itemsPayload, orderData.order_id)

      await maybeSendCustomerDeliveryEmailFromOrderDetails(orderData, itemsWithNotes, finalStatus)

      return NextResponse.json({
        success: true,
        orderId: orderData.order_id,
        transactionId: orderData.transaction_id,
        amount: orderData.total_amount,
        status: finalStatus,
        paymentMethod: orderData.payment_method,
        customerName: orderData.customer_name,
        customerEmail: orderData.customer_email,
        customerPhone: orderData.customer_phone,
        transactionTime: orderData.created_at,
        paidAt: orderData.paid_at,
        items: itemsWithNotes,
        itemsReady: finalItemsWithData.length > 0,
      })
    }

    // If not completed in DB, double-check Midtrans live status
    const midtrans = await getFromMidtransRaw(orderId)
    if (midtrans.success) {
      const normalizedMidtransStatus = normalizeStatus(midtrans.status)
      const baseItems = itemsPayload.length ? itemsPayload : midtrans.items
      const itemsWithNotes = await attachProductNotes(baseItems, orderData.order_id)

      await maybeSendCustomerDeliveryEmailFromOrderDetails(orderData, itemsWithNotes, normalizedMidtransStatus)

      return NextResponse.json({
        success: true,
        orderId: orderData.order_id,
        transactionId: orderData.transaction_id || midtrans.transactionId,
        amount: orderData.total_amount || midtrans.amount,
        status: normalizedMidtransStatus,
        paymentMethod: orderData.payment_method,
        customerName: orderData.customer_name,
        customerEmail: orderData.customer_email,
        customerPhone: orderData.customer_phone,
        transactionTime: orderData.created_at || midtrans.transactionTime,
        paidAt: orderData.paid_at,
        items: itemsWithNotes,
      })
    }

    // Fallback: return DB status if Midtrans check fails
    const itemsWithNotes = await attachProductNotes(itemsPayload, orderData.order_id)

    await maybeSendCustomerDeliveryEmailFromOrderDetails(orderData, itemsWithNotes, normalizedDbStatus)

    return NextResponse.json({
      success: true,
      orderId: orderData.order_id,
      transactionId: orderData.transaction_id,
      amount: orderData.total_amount,
      status: normalizedDbStatus,
      paymentMethod: orderData.payment_method,
      customerName: orderData.customer_name,
      customerEmail: orderData.customer_email,
      customerPhone: orderData.customer_phone,
      transactionTime: orderData.created_at,
      paidAt: orderData.paid_at,
      items: itemsWithNotes,
    })
  } catch (error: any) {
    console.error('[Order Details] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get order details' },
      { status: 500 }
    )
  }
}

async function getFromMidtrans(orderId: string) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const apiBase = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const url = `${apiBase}/v2/${encodeURIComponent(orderId)}/status`

    console.log('[Order Details] Fallback to Midtrans:', orderId)

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

    return NextResponse.json({
      success: true,
      orderId: transaction.order_id,
      transactionId: transaction.transaction_id,
      amount: transaction.gross_amount,
      status: transaction.transaction_status,
      transactionTime: transaction.transaction_time,
      items: transaction.item_details || [],
    })
  } catch (error: any) {
    console.error('[Midtrans Fallback] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get order details' },
      { status: 500 }
    )
  }
}

// Raw Midtrans fetch for reuse
async function getFromMidtransRaw(orderId: string) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const apiBase = isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'

    const auth = Buffer.from(String(serverKey) + ':').toString('base64')
    const url = `${apiBase}/v2/${encodeURIComponent(orderId)}/status`

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

    return {
      success: true,
      orderId: transaction.order_id,
      transactionId: transaction.transaction_id,
      amount: transaction.gross_amount,
      status: transaction.transaction_status,
      transactionTime: transaction.transaction_time,
      items: transaction.item_details || [],
    }
  } catch (error: any) {
    console.error('[Midtrans Raw] Error:', error)
    return { success: false, error: error.message }
  }
}
