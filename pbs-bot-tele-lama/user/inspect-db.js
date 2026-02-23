const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function inspectDatabase() {
  console.log('🔍 Inspecting database structure...\n')
  
  // Get one product to see its structure
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error:', error.message)
    return
  }

  if (data && data.length > 0) {
    console.log('📋 Product table columns:')
    console.log(JSON.stringify(data[0], null, 2))
  } else {
    console.log('No products found')
  }
}

inspectDatabase()
