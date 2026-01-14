# 🔧 RLS FIX - COMMAND REFERENCE

## Quick Commands

### 1️⃣ Apply Migration (in Supabase UI)
```sql
-- Go to: https://app.supabase.com → PBS-Manager → SQL Editor → + New Query
-- Copy entire file: supabase/migrations/004_fix_rls_policies.sql
-- Run in Supabase SQL Editor
```

### 2️⃣ Verify Migration Applied
```bash
# Verify in Supabase SQL Editor
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';
# Result: users | f (f = RLS disabled) ✅
```

### 3️⃣ Run Verification Script
```bash
cd d:\Bot\bot-telegram-pbs
node scripts/verify-rls-fix.js
```

### 4️⃣ Restart Bot
```bash
npm start
```

### 5️⃣ Test Payment Flow
```bash
# In Telegram bot chat:
/buy ytbg
# Follow payment instructions
# Verify: "✅ Item telah dikirim ke chat Anda"
```

### 6️⃣ Check Bot Logs
```bash
tail -f logs/bot.log
# Look for: [DELIVERY] Sending items
```

### 7️⃣ Check Dashboard
```
https://dashboard-url/dashboard/orders
# Should show: New order with Paid status
```

---

## Verification Queries (Supabase SQL Editor)

### Check Users Table RLS Status
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('users', 'orders', 'order_items', 'products', 'product_items')
AND schemaname = 'public';
```

**Expected result:**
```
users          | f
orders         | t
order_items    | t
products       | t
product_items  | t
```

### Check All Policies
```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    qual as policy_condition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Policy Count (should have many new ones)
```sql
SELECT COUNT(*) as policy_count 
FROM pg_policies 
WHERE schemaname = 'public';
```

---

## Common Issues & Fixes

### ❌ Issue: "Error: new row violates row-level security policy"
**Fix**: Migration not applied
```bash
# 1. Check migration in Supabase SQL Editor
SELECT * FROM pg_migrations; -- or check manually

# 2. Re-run migration 004
# Copy: supabase/migrations/004_fix_rls_policies.sql
# Paste in: Supabase → SQL Editor → Run

# 3. Verify:
node scripts/verify-rls-fix.js
```

### ❌ Issue: "Test failed - User insert blocked"
**Fix**: RLS still enabled on users table
```sql
-- In Supabase SQL Editor:
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'users';
-- If result shows: users | t (t = RLS enabled)
-- Then run:
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

### ❌ Issue: Bot logs show "no_reserved_items"
**Fix**: Order creation is still failing
```bash
# 1. Check bot environment variables:
cat .env.local | grep SUPABASE
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set

# 2. Verify migration:
node scripts/verify-rls-fix.js

# 3. Check bot logs:
tail -f logs/bot.log | grep -i "order\|user\|persist"
```

### ❌ Issue: Dashboard Orders still empty
**Fix**: Orders not being created in database
```bash
# 1. Test Supabase connection:
npm run test-supabase-connection

# 2. Check orders table:
# In Supabase: Select icon → orders table
# Should see test rows from verify script

# 3. If empty, run:
node scripts/verify-rls-fix.js
# (It creates and cleans up test data)
```

---

## Log Patterns to Look For

### ✅ Successful Payment Flow
```
[PURCHASE] Creating order ORD-...
[RESERVE] Successfully reserved items
[PAYMENT] Awaiting payment notification
[PAYMENT SUCCESS] Payment settlement received
[FINALIZE] Finalizing reserved items
[DELIVERY] Sending items to user ← THIS IS KEY
```

### ❌ Failed Payment Flow (Before Fix)
```
[ORDER PERSIST WARN] Could not persist order/user: 
  new row violates row-level security policy for table "users"
[FINALIZE ERROR] Finalize gagal: no_reserved_items
[ERROR] Cannot coerce result to single JSON object
```

### ✅ Successful After Fix
```
[ORDER PERSIST] User created: 1099822426
[ORDER PERSIST] Order created: ORD-...
[RESERVE] Stock reserved: 1 items
[FINALIZE] Items finalized
[DELIVERY] Items sent ✅
```

---

## Files & Locations

### Migrations
- Location: `supabase/migrations/`
- Files:
  - `001_initial_schema.sql` - Initial tables
  - `002_product_items.sql` - Product items table
  - `003_fix_foreign_keys_simple.sql` - FK constraints (old RLS - removed)
  - **`004_fix_rls_policies.sql`** - NEW RLS fix

### Configuration
- Dashboard URL: Check `NEXT_PUBLIC_SUPABASE_URL`
- Bot: Check `.env.local` SUPABASE_* vars

### Logs
- Bot logs: `logs/bot.log`
- Bot errors: `logs/bot.err`
- Dashboard: Supabase console

---

## Step-by-Step Execution

```bash
# 1. Apply Migration (in Supabase UI - 2 min)
#    See section: "Apply Migration"

# 2. Verify Applied (1 min)
node scripts/verify-rls-fix.js

# 3. Restart Bot (30 sec)
npm start

# 4. Wait for startup message:
# "Telegram bot connected and listening..."

# 5. Test in Telegram (2 min)
# Send: /buy ytbg
# Complete payment
# Check: ✅ Item telah dikirim

# 6. Verify in Dashboard (30 sec)
# Go to: Orders page
# See: New order with Paid status

# 7. Check Logs (30 sec)
tail -f logs/bot.log
# Look for: [DELIVERY] Sending items
```

---

## Success Checklist

- [ ] Migration 004 applied in Supabase
- [ ] Verification script passed: ✅ All tests
- [ ] Bot restarted
- [ ] Test payment processed
- [ ] Bot sent items to user chat
- [ ] Dashboard shows new order
- [ ] Midtrans webhook not in retry queue
- [ ] Bot logs show [DELIVERY]

---

## Rollback (if needed)

```sql
-- In Supabase SQL Editor
-- ONLY IF SOMETHING BREAKS

-- Re-enable RLS on users table:
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Re-create old policies:
-- (Run migration 003 again)
```

---

## Contact & Support

If still having issues:
1. Run: `node scripts/verify-rls-fix.js`
2. Share output in issue
3. Share bot logs: `cat logs/bot.log | tail -50`
4. Check: RLS-FIX-GUIDE.md troubleshooting section
