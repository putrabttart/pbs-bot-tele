/**
 * Script untuk check products di database
 * Dan menambahkan sample products jika kosong
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndSeedProducts() {
  console.log('🔍 Checking products in database...\n')
  
  // Check existing products (without is_active filter)
  const { data: products, error } = await supabase
    .from('products')
    .select('*')

  if (error) {
    console.error('❌ Error fetching products:', error.message)
    console.log('\n💡 Possible issues:')
    console.log('   1. Table "products" does not exist - run migrations first')
    console.log('   2. RLS policy blocks anonymous access')
    console.log('   3. Supabase credentials are incorrect\n')
    return
  }

  console.log(`📊 Found ${products.length} product(s)\n`)

  if (products.length > 0) {
    console.log('✅ Products exist in database:\n')
    products.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name}`)
      console.log(`      - Category: ${p.category || 'N/A'}`)
      console.log(`      - Price: Rp ${(p.price || 0).toLocaleString('id-ID')}`)
      console.log(`      - Stock: ${p.stock}`)
      console.log()
    })
    return
  }

  console.log('⚠️  No products found in database!')
  console.log('📝 Would you like to add sample products? (Y/n)\n')

  // Auto add sample products for quick testing
  console.log('➕ Adding sample products...\n')

  const sampleProducts = [
    {
      name: 'Netflix Premium 1 Bulan',
      description: 'Akun Netflix Premium untuk 1 bulan, 4 layar HD/UHD',
      price: 50000,
      stock: 10,
      category: 'Streaming',
      image_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400'
    },
    {
      name: 'Spotify Premium 3 Bulan',
      description: 'Nikmati musik tanpa iklan selama 3 bulan',
      price: 45000,
      stock: 15,
      category: 'Streaming',
      image_url: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400'
    },
    {
      name: 'Canva Pro 1 Tahun',
      description: 'Akses penuh fitur Canva Pro untuk desain profesional',
      price: 120000,
      stock: 8,
      category: 'Desain',
      image_url: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400'
    },
    {
      name: 'Google Drive 100GB',
      description: 'Penyimpanan cloud Google Drive 100GB selama 1 bulan',
      price: 30000,
      stock: 20,
      category: 'Penyimpanan',
      image_url: 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=400'
    },
    {
      name: 'Grammarly Premium',
      description: 'Asisten menulis AI untuk bahasa Inggris yang sempurna',
      price: 75000,
      stock: 5,
      category: 'Produktivitas',
      image_url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400'
    },
    {
      name: 'VPN Premium 1 Bulan',
      description: 'Akses internet aman dan private, unlimited bandwidth',
      price: 35000,
      stock: 12,
      category: 'Keamanan',
      image_url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400'
    }
  ]

  const { data: inserted, error: insertError } = await supabase
    .from('products')
    .insert(sampleProducts)
    .select()

  if (insertError) {
    console.error('❌ Error adding sample products:', insertError.message)
    console.log('\n💡 Make sure:')
    console.log('   1. The products table exists')
    console.log('   2. RLS policies allow insert (or use service role key)')
    console.log('   3. All required columns are present\n')
    return
  }

  console.log(`✅ Successfully added ${inserted.length} sample products!\n`)
  inserted.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} - Rp ${(p.price || 0).toLocaleString('id-ID')}`)
  })
  console.log('\n🎉 You can now browse products in your store!')
  console.log('🌐 Visit: http://localhost:3001\n')
}

// Check RLS policies
async function checkRLSPolicies() {
  console.log('\n🔐 Checking RLS policies...\n')
  
  // Try to read products (should work with anon key if RLS is correct)
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .limit(1)

  if (error) {
    console.log('❌ RLS Policy Issue Detected!')
    console.log('   Error:', error.message)
    console.log('\n📋 Required RLS Policy for products table:')
    console.log(`
    CREATE POLICY "Products are viewable by everyone"
    ON products FOR SELECT
    TO anon, authenticated
    USING (is_active = true);
    `)
    console.log('   Run this SQL in your Supabase SQL Editor\n')
    return false
  }

  console.log('✅ RLS policies are correctly configured\n')
  return true
}

// Main
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('   PBS Store - Database Check & Seeder    ')
  console.log('═══════════════════════════════════════════\n')

  await checkRLSPolicies()
  await checkAndSeedProducts()
  
  console.log('═══════════════════════════════════════════')
  console.log('Done! 🎉')
  console.log('═══════════════════════════════════════════\n')
}

main().catch(console.error)
