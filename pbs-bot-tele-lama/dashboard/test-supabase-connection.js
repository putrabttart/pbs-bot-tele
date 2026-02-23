/**
 * Test Supabase Connection & Auth Setup
 * Run: node test-supabase-connection.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Testing Supabase Connection...\n')

// Check environment variables
console.log('1️⃣ Checking environment variables:')
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Set' : '❌ Missing'}`)
console.log(`   SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('\n❌ ERROR: Missing environment variables!')
  console.log('\n📝 Create .env.local file with:')
  console.log('   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co')
  console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...')
  process.exit(1)
}

// Test connection
async function testConnection() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    console.log('\n2️⃣ Testing database connection...')
    
    // Test products table
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(1)

    if (productsError) {
      console.log(`   ❌ Products table: ${productsError.message}`)
    } else {
      console.log(`   ✅ Products table accessible (${products?.length || 0} rows fetched)`)
    }

    // Test product_items table
    const { data: items, error: itemsError } = await supabase
      .from('product_items')
      .select('*')
      .limit(1)

    if (itemsError) {
      console.log(`   ❌ Product items table: ${itemsError.message}`)
    } else {
      console.log(`   ✅ Product items table accessible (${items?.length || 0} rows fetched)`)
    }

    // Test orders table
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1)

    if (ordersError) {
      console.log(`   ❌ Orders table: ${ordersError.message}`)
    } else {
      console.log(`   ✅ Orders table accessible (${orders?.length || 0} rows fetched)`)
    }

    console.log('\n3️⃣ Checking auth configuration...')
    
    // Check if we can access auth endpoints
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.log(`   ℹ️  No active session (expected for this test)`)
    } else {
      console.log(`   ✅ Auth endpoint accessible`)
    }

    console.log('\n✅ All checks completed!')
    console.log('\n📋 Next steps:')
    console.log('   1. Create admin user in Supabase Dashboard:')
    console.log('      → Authentication → Users → Add user')
    console.log('   2. Start dashboard: npm run dev')
    console.log('   3. Login at: http://localhost:3000/login')

  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message)
    console.error('\n🔧 Troubleshooting:')
    console.error('   1. Check if SUPABASE_URL is correct')
    console.error('   2. Check if SUPABASE_ANON_KEY is correct')
    console.error('   3. Check if tables exist in Supabase')
    console.error('   4. Run migrations: npx supabase db push')
    process.exit(1)
  }
}

testConnection()
