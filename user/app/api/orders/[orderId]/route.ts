import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  isValidCustomerEmail,
  normalizeCustomerEmail,
  sendOrderDeliveryEmailWithRetry,
} from '@/lib/email/smtp-delivery'
import { logError, logInfo, logWarn, summarizeOrderForLog } from '@/lib/logging/terminal-log'

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
      logWarn('Order Details', 'Failed fetching product item notes', {
        orderId,
        error: error.message,
        productCodeCount: codes.length,
      })
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
    logWarn('Order Details', 'Product notes attachment exception', {
      orderId,
      error: String(err?.message || err),
    })
    return items
  }
}

const normalizeErrorMessage = (error: unknown, maxLength = 500) => {
  const raw = String(error || 'unknown_error').replace(/\s+/g, ' ').trim()
  if (!raw) return 'unknown_error'
  return raw.length > maxLength ? raw.slice(0, maxLength) : raw
}

const EMAIL_PROCESSING_STALE_MS = Math.max(
  30000,
  Number.parseInt(String(process.env.ORDER_EMAIL_PROCESSING_STALE_MS || '120000'), 10) || 120000
)

const reclaimStaleOrderDetailsEmailProcessing = async (orderId: string) => {
  const cutoffIso = new Date(Date.now() - EMAIL_PROCESSING_STALE_MS).toISOString()
  const nowIso = new Date().toISOString()

  const updatePayload = {
    delivery_email_status: 'processing',
    delivery_email_last_attempt_at: nowIso,
    delivery_email_last_error: 'stale_processing_reclaimed',
  }

  const { data: staleData, error: staleError } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .eq('delivery_email_status', 'processing')
    .lt('delivery_email_last_attempt_at', cutoffIso)
    .select('order_id, delivery_email_attempts')
    .maybeSingle()

  if (staleError) {
    logWarn('Order Details', 'Stale-processing reclaim query failed', {
      orderId,
      message: staleError.message,
    })
    return null
  }

  if (staleData) {
    logWarn('Order Details', 'Reclaimed stale email processing lock', {
      orderId,
      staleCutoffIso: cutoffIso,
    })
    return staleData
  }

  const { data: nullAttemptData, error: nullAttemptError } = await supabase
    .from('orders')
    .update(updatePayload)
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .eq('delivery_email_status', 'processing')
    .is('delivery_email_last_attempt_at', null)
    .select('order_id, delivery_email_attempts')
    .maybeSingle()

  if (nullAttemptError) {
    logWarn('Order Details', 'Null-attempt reclaim query failed', {
      orderId,
      message: nullAttemptError.message,
    })
    return null
  }

  if (nullAttemptData) {
    logWarn('Order Details', 'Reclaimed processing lock with null last_attempt_at', { orderId })
    return nullAttemptData
  }

  return null
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
      const reclaimed = await reclaimStaleOrderDetailsEmailProcessing(orderId)
      if (reclaimed) {
        return {
          claimed: true as const,
          attempts: Number(reclaimed.delivery_email_attempts || 0),
        }
      }

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
    logWarn('Order Details', 'Failed updating email delivery state', {
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
      logWarn('Order Details', 'Email delivery claim skipped with error', {
        orderId,
        error: claim.error,
      })
    }
    return
  }

  const previousAttempts = Number(claim.attempts || 0)
  try {
    const customerEmail = normalizeCustomerEmail(String(orderData?.customer_email || ''))

    if (!isValidCustomerEmail(customerEmail)) {
      await updateOrderDetailsEmailDeliveryState(orderId, {
        status: 'failed',
        attempts: previousAttempts + 1,
        lastError: 'invalid_customer_email',
      })
      logWarn('Order Details', 'Invalid customer email for delivery copy', {
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
      logInfo('Order Details', 'Delivery email sent from fallback path', {
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

    logWarn('Order Details', 'Delivery email failed from fallback path', {
      orderId,
      attempts: sendResult.attempts,
      error: sendResult.error,
    })
  } catch (error: unknown) {
    const unexpectedError = normalizeErrorMessage(error)

    await updateOrderDetailsEmailDeliveryState(orderId, {
      status: 'failed',
      attempts: previousAttempts + 1,
      lastError: `unexpected_exception:${unexpectedError}`,
    })

    logWarn('Order Details', 'Unexpected exception in fallback delivery-email flow', {
      orderId,
      error: unexpectedError,
    })
  }
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

    logInfo('Order Details', 'Fetch order from database', { orderId })

    // Get order from database
    const { data: orderData, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (dbError || !orderData) {
      logWarn('Order Details', 'Order not found in database', {
        orderId,
        error: dbError?.message,
      })
      
      // Fallback: Get from Midtrans if not in database
      return await getFromMidtrans(orderId)
    }

    logInfo('Order Details', 'Order row loaded', {
      orderId,
      order: summarizeOrderForLog(orderData),
    })

    // Get fulfilled items (with item_data) if available
    const { data: orderItemsData, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_code, product_name, quantity, price, item_data')
      .eq('order_id', orderData.id)

    if (orderItemsError) {
      logWarn('Order Details', 'Could not load order_items', {
        orderId,
        error: orderItemsError.message,
      })
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
        logInfo('Order Details', 'Pending order checking Midtrans', {
          orderId,
          elapsedSeconds: Math.round(elapsedSeconds),
        })
        const midtransCheck = await getFromMidtransRaw(orderId)
        
        if (midtransCheck.success) {
          const mtStatus = normalizeStatus(midtransCheck.status)
          logInfo('Order Details', 'Midtrans status resolved', {
            orderId,
            midtransStatus: midtransCheck.status,
            normalizedStatus: mtStatus,
          })
          
          if (mtStatus === 'completed') {
            logInfo('Order Details', 'Syncing completed status from Midtrans', { orderId })

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
              logError('Order Details', 'Failed to update status from Midtrans sync', {
                orderId,
                error: updateError.message,
              })
            } else if (!updatedRows || updatedRows.length === 0) {
              logInfo('Order Details', 'Status already synced by another process', { orderId })
            } else {
              logInfo('Order Details', 'Status updated to completed', { orderId })
              
              // Trigger finalization
              try {
                const { data: finalizeResult } = await supabase
                  .rpc('finalize_items_for_order', {
                    p_order_id: orderId,
                    p_user_id: 0
                  })
                if (finalizeResult?.ok) {
                  logInfo('Order Details', 'Finalize RPC success during sync', {
                    orderId,
                    finalizedCount: finalizeResult.count,
                  })
                }
              } catch (e) {
                logError('Order Details', 'Finalize RPC error during sync', {
                  orderId,
                  error: String((e as any)?.message || e),
                })
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
        logWarn('Order Details', 'Completed order has no item_data; attempting finalization', { orderId })
        
        // Check if items already exist in order_items with data to prevent re-finalization loop
        const { data: existingItems, error: checkError } = await supabase
          .from('order_items')
          .select('product_code, item_data')
          .eq('order_id', orderData.id)
          .not('item_data', 'is', null)

        const existingItemsWithData = (existingItems || []).filter((item: any) => hasNonEmptyItemData(item?.item_data))

        if (!checkError && existingItemsWithData.length > 0) {
          logInfo('Order Details', 'Found existing order_items with item_data', {
            orderId,
            itemRows: existingItemsWithData.length,
          })
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
          logInfo('Order Details', 'Starting finalization process', { orderId })
          try {
            // First, try finalize (for reserved items)
            logInfo('Order Details', 'Finalize step 1: call RPC', { orderId })
            const { data: finalizeResult, error: finalizeError } = await supabase
              .rpc('finalize_items_for_order', {
                p_order_id: orderId,
                p_user_id: 0
              })

            if (finalizeError) {
              logError('Order Details', 'Finalize RPC error', {
                orderId,
                error: finalizeError.message,
                code: finalizeError.code,
              })
            } else {
              logInfo('Order Details', 'Finalize RPC response', {
                orderId,
                ok: finalizeResult?.ok,
                count: finalizeResult?.count,
                itemsCount: finalizeResult?.items?.length || 0,
              })
            }

            let itemsToSave: any[] = []

            if (!finalizeError && finalizeResult?.ok && finalizeResult.items?.length > 0) {
              logInfo('Order Details', 'Finalize step 1 success', {
                orderId,
                finalizedCount: finalizeResult.count,
              })
              itemsToSave = finalizeResult.items
            } else {
              // If finalize fails (items already sold), fetch sold items directly from product_items
              logInfo('Order Details', 'Finalize step 2: fetch sold items fallback', { orderId })
              
              const productCodes = (orderData.items || []).map((i: any) => i.product_code)
              logInfo('Order Details', 'Sold fallback product codes', {
                orderId,
                productCodes,
              })
              
              const { data: soldItems, error: soldError } = await supabase
                .from('product_items')
                .select('id, product_code, item_data')
                .eq('order_id', orderId)
                .eq('status', 'sold')
                .in('product_code', productCodes)

              if (soldError) {
                logError('Order Details', 'Sold items fallback query error', {
                  orderId,
                  error: soldError.message,
                })
              } else {
                logInfo('Order Details', 'Sold items fallback query result', {
                  orderId,
                  count: soldItems?.length || 0,
                })
              }

              if (!soldError && soldItems && soldItems.length > 0) {
                logInfo('Order Details', 'Found sold items for fallback', {
                  orderId,
                  count: soldItems.length,
                })
                itemsToSave = soldItems
              } else {
                logWarn('Order Details', 'No sold items found for order', { orderId })
              }
            }

            // Save items to order_items table (only if not already saved)
            if (itemsToSave.length > 0) {
              logInfo('Order Details', 'Finalize step 3: save to order_items', {
                orderId,
                itemsToSave: itemsToSave.length,
              })
              let savedCount = 0
              
              for (const item of itemsToSave) {
                const orderItem = (orderData.items || []).find((i: any) => i.product_code === item.product_code)

                if (!orderItem) {
                  logWarn('Order Details', 'No matching snapshot item; using fallback values', {
                    orderId,
                    productCode: item.product_code,
                  })
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
                  logInfo('Order Details', 'Order item already exists, skipping insert', {
                    orderId,
                    productCode: item.product_code,
                    itemDataLength: String(item.item_data || '').length,
                  })
                  savedCount++
                  continue
                }

                logInfo('Order Details', 'Inserting order item', {
                  orderId,
                  productCode: item.product_code,
                  itemDataLength: String(item.item_data || '').length,
                })

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
                  logError('Order Details', 'Insert order_item failed', {
                    orderId,
                    productCode: item.product_code,
                    error: insertError.message,
                    code: insertError.code,
                  })
                } else {
                  logInfo('Order Details', 'Inserted order_item', {
                    orderId,
                    productCode: item.product_code,
                  })
                  savedCount++
                }
              }

              logInfo('Order Details', 'Finalize step 3 complete, waiting for DB consistency', {
                orderId,
                savedCount,
                requestedSaveCount: itemsToSave.length,
              })

              const optimisticItems = itemsToSave
                .map((item: any) => {
                  const snapshotItem = (orderData.items || []).find((i: any) => i.product_code === item.product_code)
                  return {
                    product_code: item.product_code,
                    product_name: snapshotItem?.product_name || item.product_code || 'Item Digital',
                    quantity: 1,
                    price: Number(snapshotItem?.price || 0),
                    item_data: String(item.item_data || ''),
                  }
                })
                .filter((item: any) => hasNonEmptyItemData(item.item_data))

              if (optimisticItems.length > 0) {
                const combinedOptimistic = combineByProductCode(optimisticItems)
                const optimisticPayload = snapshotItems.map((snap: any) => {
                  const fulfilled = combinedOptimistic[snap.product_code]
                  return fulfilled ? { ...snap, ...fulfilled } : snap
                })

                for (const combinedItem of Object.values(combinedOptimistic)) {
                  const code = String((combinedItem as any)?.product_code || '')
                  if (!code) continue
                  const exists = optimisticPayload.some((it: any) => String(it?.product_code || '') === code)
                  if (!exists) {
                    optimisticPayload.push(combinedItem)
                  }
                }

                if (optimisticPayload.some((item: any) => hasNonEmptyItemData(item.item_data))) {
                  itemsPayload = optimisticPayload
                  logInfo('Order Details', 'Applied optimistic item merge before refresh', { orderId })
                }
              }

              // Wait longer to ensure DB commit
              await new Promise(resolve => setTimeout(resolve, 500))

              // Step 4: Refresh to verify
              logInfo('Order Details', 'Finalize step 4: refresh order_items', { orderId })
              const { data: refreshedItems, error: refreshError } = await supabase
                .from('order_items')
                .select('product_code, product_name, quantity, price, item_data')
                .eq('order_id', orderData.id)

              if (refreshError) {
                logError('Order Details', 'Refresh order_items query error', {
                  orderId,
                  error: refreshError.message,
                })
              } else {
                logInfo('Order Details', 'Refresh order_items result', {
                  orderId,
                  count: refreshedItems?.length || 0,
                })
                
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

                  logInfo('Order Details', 'itemsPayload updated from refresh rows', {
                    orderId,
                    count: refreshedItems.length,
                  })
                } else {
                  logWarn('Order Details', 'Refresh returned 0 rows, using sold fallback', { orderId })

                  const fallbackCodes = (orderData.items || []).map((i: any) => i.product_code).filter(Boolean)
                  if (fallbackCodes.length > 0) {
                    const { data: soldFallback, error: soldFallbackError } = await supabase
                      .from('product_items')
                      .select('product_code, item_data')
                      .eq('order_id', orderId)
                      .eq('status', 'sold')
                      .in('product_code', fallbackCodes)

                    if (soldFallbackError) {
                      logWarn('Order Details', 'Sold fallback query error', {
                        orderId,
                        error: soldFallbackError.message,
                      })
                    } else {
                      const soldWithData = (soldFallback || [])
                        .map((item: any) => {
                          const snapshotItem = (orderData.items || []).find((i: any) => i.product_code === item.product_code)
                          return {
                            product_code: item.product_code,
                            product_name: snapshotItem?.product_name || item.product_code || 'Item Digital',
                            quantity: 1,
                            price: Number(snapshotItem?.price || 0),
                            item_data: String(item.item_data || ''),
                          }
                        })
                        .filter((item: any) => hasNonEmptyItemData(item.item_data))

                      if (soldWithData.length > 0) {
                        const combinedFallback = combineByProductCode(soldWithData)
                        const fallbackPayload = snapshotItems.map((snap: any) => {
                          const fulfilled = combinedFallback[snap.product_code]
                          return fulfilled ? { ...snap, ...fulfilled } : snap
                        })

                        for (const combinedItem of Object.values(combinedFallback)) {
                          const code = String((combinedItem as any)?.product_code || '')
                          if (!code) continue
                          const exists = fallbackPayload.some((it: any) => String(it?.product_code || '') === code)
                          if (!exists) {
                            fallbackPayload.push(combinedItem)
                          }
                        }

                        itemsPayload = fallbackPayload
                        logInfo('Order Details', 'Loaded item_data from product_items fallback', {
                          orderId,
                          fallbackCount: soldWithData.length,
                        })
                      }
                    }
                  }
                }
              }
            } else {
              logWarn('Order Details', 'itemsToSave is empty; nothing to save', { orderId })
            }
          } catch (err: any) {
            logError('Order Details', 'Finalization exception', {
              orderId,
              error: err.message,
            })
          }
        }
      } else {
        logInfo('Order Details', 'Items already ready', {
          orderId,
          count: itemsWithData.length,
        })
      }
      
      // CRITICAL: Check if items are ready before returning status
      const finalItemsWithData = itemsPayload.filter((item: any) => hasNonEmptyItemData(item.item_data))
      const finalStatus = finalItemsWithData.length > 0 ? normalizedDbStatus : 'processing'
      
      if (finalItemsWithData.length === 0) {
        logWarn('Order Details', 'Items still empty after finalization, returning processing', {
          orderId,
        })
      } else {
        logInfo('Order Details', 'Ready response with item data', {
          orderId,
          count: finalItemsWithData.length,
        })
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
    logError('Order Details', 'Unhandled GET error', {
      error: error?.message || String(error),
    })
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

    logInfo('Order Details', 'Fallback request to Midtrans status', { orderId })

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
    logError('Order Details', 'Midtrans fallback error', {
      orderId,
      error: error.message,
    })
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
    logError('Order Details', 'Midtrans raw status error', {
      orderId,
      error: error.message,
    })
    return { success: false, error: error.message }
  }
}
