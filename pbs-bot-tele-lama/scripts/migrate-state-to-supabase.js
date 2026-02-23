// scripts/migrate-state-to-supabase.js
// Migration script: Migrate bot-state.json to Supabase

import fs from 'fs';
import path from 'path';
import { upsertUser } from '../src/database/users.js';
import { addFavorite } from '../src/database/users.js';
import { logger } from '../src/utils/logger.js';

const STATE_FILE = path.join(process.cwd(), 'data', 'bot-state.json');

/**
 * Migrate user data and favorites
 */
async function migrate() {
  try {
    console.log('\n' + '═'.repeat(60));
    console.log('  👥  MIGRASI USER STATE: bot-state.json → Supabase');
    console.log('═'.repeat(60) + '\n');
    
    // Check if file exists
    if (!fs.existsSync(STATE_FILE)) {
      console.log('⚠️  bot-state.json tidak ditemukan');
      console.log('   Lokasi: ' + STATE_FILE);
      console.log('   Skip migration\n');
      process.exit(0);
    }
    
    console.log('📥 Reading bot-state.json...');
    const stateData = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    
    console.log(`   Version: ${stateData.version || 'unknown'}`);
    console.log(`   Saved at: ${stateData.savedAt || 'unknown'}\n`);
    
    // Migrate users
    if (stateData.users && stateData.users.length > 0) {
      console.log(`👥 Migrating ${stateData.users.length} users...`);
      
      let userCount = 0;
      for (const [userId, userData] of stateData.users) {
        try {
          await upsertUser({
            user_id: userId,
            username: userData.username || null,
            first_name: userData.first_name || null,
            last_name: userData.last_name || null,
            language: userData.language || 'id',
          });
          userCount++;
        } catch (error) {
          console.error(`   ❌ Failed to migrate user ${userId}:`, error.message);
        }
      }
      
      console.log(`   ✅ Migrated ${userCount} users\n`);
    }
    
    // Migrate favorites
    if (stateData.favorites && stateData.favorites.length > 0) {
      console.log(`⭐ Migrating favorites...`);
      
      let favCount = 0;
      for (const [userId, productCodes] of stateData.favorites) {
        if (!Array.isArray(productCodes) || productCodes.length === 0) continue;
        
        // Note: We need to convert product codes to product IDs
        // This requires querying products table
        console.log(`   User ${userId}: ${productCodes.length} favorites (skip - needs manual mapping)`);
      }
      
      console.log(`   ⚠️  Favorites migration needs manual product ID mapping\n`);
    }
    
    // Migrate order history
    if (stateData.history && stateData.history.length > 0) {
      console.log(`📜 Found ${stateData.history.length} users with purchase history`);
      console.log(`   ⚠️  Order history migration handled by Midtrans webhook\n`);
    }
    
    // Analytics
    if (stateData.analytics) {
      console.log('📊 Analytics data found:');
      console.log(`   Total orders: ${stateData.analytics.totalOrders || 0}`);
      console.log(`   Total revenue: Rp ${(stateData.analytics.totalRevenue || 0).toLocaleString('id-ID')}`);
      console.log(`   ⚠️  Analytics will be rebuilt from Supabase data\n`);
    }
    
    console.log('═'.repeat(60));
    console.log('  ✅  STATE MIGRATION COMPLETED!');
    console.log('═'.repeat(60) + '\n');
    
    console.log('📝 Next steps:');
    console.log('   1. Favorites need manual product ID mapping');
    console.log('   2. Order history will rebuild from new orders');
    console.log('   3. Analytics will auto-update from Supabase\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run migration
migrate();
