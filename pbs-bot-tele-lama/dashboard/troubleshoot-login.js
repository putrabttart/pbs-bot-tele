#!/usr/bin/env node

/**
 * Complete Supabase & Login Troubleshooting
 * Run: node troubleshoot-login.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('\n')
console.log('═'.repeat(60))
console.log('  🔧 SUPABASE LOGIN TROUBLESHOOTING')
console.log('═'.repeat(60))

// Step 1: Check environment
console.log('\n1️⃣  ENVIRONMENT CONFIGURATION')
console.log('─'.repeat(60))

const envFile = path.join(__dirname, '.env.local')
if (fs.existsSync(envFile)) {
  console.log('✅ .env.local file exists')
} else {
  console.log('❌ .env.local file NOT found!')
  console.log('   Create .env.local with Supabase credentials')
  process.exit(1)
}

console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : '❌ Missing'}`)
console.log(`✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 20) + '...' : '❌ Missing'}`)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log('\n❌ Missing required environment variables!')
  process.exit(1)
}

// Step 2: Test connection
async function runTests() {
  console.log('\n2️⃣  DATABASE CONNECTION TEST')
  console.log('─'.repeat(60))
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Test products
    const { error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(1)

    if (productsError) {
      console.log(`❌ Products table: ${productsError.message}`)
      return false
    }
    console.log('✅ Products table: Connected')

    // Test product_items
    const { error: itemsError } = await supabase
      .from('product_items')
      .select('*')
      .limit(1)

    if (itemsError) {
      console.log(`❌ Product items table: ${itemsError.message}`)
      return false
    }
    console.log('✅ Product items table: Connected')

    // Test orders
    const { error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1)

    if (ordersError) {
      console.log(`❌ Orders table: ${ordersError.message}`)
      return false
    }
    console.log('✅ Orders table: Connected')

    console.log('\n3️⃣  AUTHENTICATION CHECK')
    console.log('─'.repeat(60))

    // Get auth users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.log(`❌ Cannot fetch users: ${usersError.message}`)
      console.log('   Note: This is expected if using anon key')
    } else if (users && users.length > 0) {
      console.log(`✅ Found ${users.length} user(s):`)
      users.forEach(user => {
        const confirmed = user.email_confirmed_at ? '✅' : '❌'
        console.log(`   ${confirmed} ${user.email} (created: ${new Date(user.created_at).toLocaleDateString()})`)
        if (!user.email_confirmed_at) {
          console.log(`      ⚠️  Email NOT confirmed - User cannot login!`)
        }
      })
    } else {
      console.log('⚠️  No users found!')
      console.log('   You need to create a user first:')
      console.log('   1. Supabase Dashboard → Authentication → Users')
      console.log('   2. Click "Add user"')
      console.log('   3. Email: admin@pbs.com')
      console.log('   4. ✅ Check "Auto Confirm User"')
    }

    console.log('\n4️⃣  TESTING LOGIN FLOW')
    console.log('─'.repeat(60))

    // Test with dummy credentials first
    const { data: testData, error: testError } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@test.com',
      password: 'test123456',
    })

    if (testError) {
      if (testError.message.includes('Invalid login credentials')) {
        console.log('✅ Auth endpoints working (rejected invalid credentials)')
      } else {
        console.log(`❌ Auth issue: ${testError.message}`)
        return false
      }
    }

    console.log('\n5️⃣  CONFIGURATION CHECKLIST')
    console.log('─'.repeat(60))

    const checks = [
      { name: 'Supabase URL configured', ok: !!SUPABASE_URL },
      { name: 'Supabase Key configured', ok: !!SUPABASE_ANON_KEY },
      { name: 'Database connection working', ok: true },
      { name: 'Auth endpoints responding', ok: true },
    ]

    checks.forEach(check => {
      console.log(`${check.ok ? '✅' : '❌'} ${check.name}`)
    })

    console.log('\n6️⃣  REQUIRED SETUP FOR LOGIN')
    console.log('─'.repeat(60))
    console.log('Before you can login, complete these steps:')
    console.log('')
    console.log('Step A: Create User in Supabase')
    console.log('  1. Go to Supabase Dashboard')
    console.log('  2. Authentication → Users → Add user')
    console.log('  3. Email: admin@pbs.com (or your email)')
    console.log('  4. Password: Create a strong password')
    console.log('  5. ✅ CHECK "Auto Confirm User"')
    console.log('  6. Click "Create user"')
    console.log('')
    console.log('Step B: Configure Redirect URLs')
    console.log('  1. Go to Supabase Dashboard')
    console.log('  2. Settings → Authentication')
    console.log('  3. Redirect URLs section')
    console.log('  4. Add: http://localhost:3000/')
    console.log('  5. Add: http://localhost:3000/dashboard')
    console.log('  6. Click "Save changes"')
    console.log('')
    console.log('Step C: Start Dashboard')
    console.log('  npm run dev')
    console.log('  Then go to: http://localhost:3000/login')
    console.log('')
    console.log('Step D: Debug if Still Stuck')
    console.log('  1. Open browser DevTools: F12')
    console.log('  2. Go to Console tab')
    console.log('  3. Look for 🔐 emoji logs')
    console.log('  4. Check for error messages in red')
    console.log('  5. Check Network tab for failed requests')

    console.log('\n' + '═'.repeat(60))
    console.log('✅ TROUBLESHOOTING COMPLETE')
    console.log('═'.repeat(60) + '\n')

    return true

  } catch (error) {
    console.error('\n❌ Critical Error:', error.message)
    console.error(error.stack)
    return false
  }
}

runTests().then(success => {
  process.exit(success ? 0 : 1)
})
