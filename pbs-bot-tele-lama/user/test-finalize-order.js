/**
 * Test script: Manually finalize product items for an existing order
 * Usage: node test-finalize-order.js PBS-1769245411759
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const orderId = process.argv[2] || 'PBS-1769245411759'

async function testFinalizeOrder() {
  console.log(`\n=== TESTING FINALIZE FOR ORDER: ${orderId} ===\n`)

  // Step 1: Check order exists
  console.log('1. Checking order...')
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id', orderId)
    .single()

  if (orderError || !order) {
    console.error('❌ Order not found:', orderError?.message)
    return
  }

  console.log('✅ Order found:', order.order_id, 'Status:', order.status)
  console.log('   Items:', JSON.stringify(order.items, null, 2))

  // Step 2: Reserve items first (if not already reserved)
  console.log('\n2. Reserving items...')
  for (const item of order.items || []) {
    const { data: reserveResult, error: reserveError } = await supabase
      .rpc('reserve_items_for_order', {
        p_order_id: orderId,
        p_product_code: item.product_code,
        p_quantity: item.quantity
      })

    if (reserveError) {
      console.error(`❌ Reserve failed for ${item.product_code}:`, reserveError.message)
    } else if (reserveResult && reserveResult.ok) {
      console.log(`✅ Reserved ${reserveResult.count} items for ${item.product_code}`)
    } else {
      console.warn(`⚠️ Reserve response:`, reserveResult)
    }
  }

  // Step 3: Check reserved items
  console.log('\n3. Checking reserved items...')
  const { data: reserved } = await supabase
    .from('product_items')
    .select('*')
    .eq('reserved_for_order', orderId)
    .eq('status', 'reserved')

  console.log(`Found ${reserved?.length || 0} reserved items`)
  if (reserved && reserved.length > 0) {
    reserved.forEach(item => {
      console.log(`  - ${item.product_code}: ${item.item_data?.substring(0, 50)}...`)
    })
  }

  // Step 4: Finalize items
  console.log('\n4. Finalizing items...')
  const { data: finalizeResult, error: finalizeError } = await supabase
    .rpc('finalize_items_for_order', {
      p_order_id: orderId,
      p_user_id: 0  // Web store placeholder
    })

  if (finalizeError) {
    console.error('❌ Finalize failed:', finalizeError.message)
    return
  }

  if (finalizeResult && finalizeResult.ok) {
    console.log(`✅ Finalized ${finalizeResult.count} items`)
    console.log('Items data:', JSON.stringify(finalizeResult.items, null, 2))

    // Step 5: Save to order_items table
    console.log('\n5. Saving to order_items table...')
    if (finalizeResult.items && finalizeResult.items.length > 0) {
      for (const item of finalizeResult.items) {
        // Find matching product from order.items
        const orderItem = order.items?.find(i => i.product_code === item.product_code)
        
        const { error: insertError } = await supabase
          .from('order_items')
          .insert({
            order_id: order.id,  // UUID
            product_id: orderItem?.product_id || null,  // products table UUID (not product_item!)
            product_code: item.product_code,
            product_name: orderItem?.product_name || '',
            quantity: 1,
            price: orderItem?.price || 0,
            item_data: item.item_data
          })

        if (insertError) {
          console.error(`❌ Failed to save ${item.product_code}:`, insertError.message)
        } else {
          console.log(`✅ Saved ${item.product_code} to order_items`)
        }
      }
    }

    // Step 6: Verify order_items
    console.log('\n6. Verifying order_items...')
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)

    console.log(`Found ${orderItems?.length || 0} items in order_items table`)
    if (orderItems && orderItems.length > 0) {
      orderItems.forEach(item => {
        console.log(`  - ${item.product_code}: ${item.item_data?.substring(0, 50)}...`)
      })
    }

    console.log('\n✅ SUCCESS! Order finalized and items saved.')
    console.log('\nNow check dashboard:')
    console.log(`http://localhost:3000/dashboard/orders (expand order ${orderId})`)
  } else {
    console.error('❌ Finalize response:', finalizeResult)
  }

  process.exit(0)
}

testFinalizeOrder().catch(err => {
  console.error('❌ Exception:', err.message)
  process.exit(1)
})
