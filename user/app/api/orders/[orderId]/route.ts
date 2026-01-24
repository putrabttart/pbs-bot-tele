import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const normalizeStatus = (status?: string) => {
  if (!status) return 'pending'
  const s = status.toLowerCase()
  if (['completed', 'success', 'settlement', 'capture'].includes(s)) return 'completed'
  if (['pending', 'pending_payment', 'waiting_payment'].includes(s)) return 'pending'
  if (['expire', 'expired', 'cancel', 'denied', 'deny', 'failed', 'failure'].includes(s)) return 'failed'
  return status
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
            
            // Update database
            const { error: updateError } = await supabase
              .from('orders')
              .update({ 
                status: 'completed',
                paid_at: new Date().toISOString(),
              })
              .eq('order_id', orderId)

            if (updateError) {
              console.error('[Order Details] Failed to update status:', updateError)
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
      const itemsWithData = itemsPayload.filter((item: any) => item.item_data)
      
      if (itemsWithData.length === 0) {
        console.log('[Order Details] ⚠️ Completed order without item_data in order_items, attempting finalization...')
        
        // Check if items already exist in order_items with data to prevent re-finalization loop
        const { data: existingItems, error: checkError } = await supabase
          .from('order_items')
          .select('product_code, item_data')
          .eq('order_id', orderData.id)
          .not('item_data', 'is', null)

        if (!checkError && existingItems && existingItems.length > 0) {
          console.log('[Order Details] ✅ Items already exist in order_items, using those')
          // Merge existing items into payload
          const combined = combineByProductCode(existingItems)
          itemsPayload = snapshotItems.map((snap: any) => {
            const fulfilled = combined[snap.product_code]
            return fulfilled ? { ...snap, ...fulfilled } : snap
          })
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
                  console.warn(`[Order Details] No matching order item for product_code: ${item.product_code}`)
                  continue
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
                    product_id: orderItem.product_id || null,
                    product_code: item.product_code,
                    product_name: orderItem.product_name || '',
                    quantity: 1,
                    price: orderItem.price || 0,
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
      const finalItemsWithData = itemsPayload.filter((item: any) => item.item_data)
      const finalStatus = finalItemsWithData.length > 0 ? normalizedDbStatus : 'processing'
      
      if (finalItemsWithData.length === 0) {
        console.log('[Order Details] ⚠️ Still no items after finalization attempt, returning "processing"')
      } else {
        console.log(`[Order Details] ✅ Ready to return with ${finalItemsWithData.length} items`)
      }
      
      // Return completed order only if items are ready
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
        items: itemsPayload,
        itemsReady: finalItemsWithData.length > 0,
      })
    }

    // If not completed in DB, double-check Midtrans live status
    const midtrans = await getFromMidtransRaw(orderId)
    if (midtrans.success) {
      const normalizedMidtransStatus = normalizeStatus(midtrans.status)
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
        items: itemsPayload.length ? itemsPayload : midtrans.items,
      })
    }

    // Fallback: return DB status if Midtrans check fails
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
      items: itemsPayload,
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
