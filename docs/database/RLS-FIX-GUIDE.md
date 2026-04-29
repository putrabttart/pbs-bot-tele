# 🔧 Fix RLS Policies - Step by Step

## 🚨 Problem Summary

RLS policies on `users` table require `auth.uid()::BIGINT`, but bot is service role (no authenticated context).

```
Error: "new row violates row-level security policy for table users"
```

**Cascade Effect:**
1. Bot cannot insert user → Order creation fails
2. Order not created → Items not reserved
3. Items not reserved → Finalize fails ("no_reserved_items")
4. Finalize fails → Items not sent to user
5. Order not in DB → Dashboard Orders empty
6. Bot returns error → Midtrans webhook stuck in retry queue

---

## ✅ Solution: Apply New Migration

### Step 1: Go to Supabase Dashboard
1. Open [https://app.supabase.com](https://app.supabase.com)
2. Select your project: **PBS-Manager**
3. Go to **SQL Editor**

### Step 2: Run Migration SQL

Copy the entire SQL from `supabase/migrations/004_fix_rls_policies.sql` and:

1. **Create New Query:**
   - Click **+ New Query**
   - Name it: `Fix RLS Policies - Migration 004`

2. **Paste the SQL:**
   - Copy all content from migration file
   - Paste into query editor

3. **Execute:**
   - Click **Run** button
   - Should complete with no errors

### Step 3: Verify Changes

Run these verification queries:

```sql
-- Check users table RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('users', 'orders', 'order_items', 'products', 'product_items')
AND schemaname = 'public';

-- Check policies
SELECT 
    schemaname,
    tablename,
    policyname,
    qual as policy_condition,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected Result:**
- `users`: `rowsecurity = false` (RLS disabled) ✅
- Other tables: `rowsecurity = true` with permissive policies ✅

---

## 🧪 Test the Fix

### Step 1: Restart Bot
```bash
# In bot directory
npm start
```

### Step 2: Run Test Payment

1. Open Telegram
2. Send `/buy ytbg` (1 item)
3. Confirm purchase amount
4. Open QR in Midtrans
5. Complete payment

### Step 3: Check Results

#### In Bot Logs:
```
✅ [PURCHASE] Creating order for user 123456
✅ [RESERVE] Reserved items for order
✅ [PAYMENT] Awaiting payment notification...
✅ [PAYMENT SUCCESS] Payment settlement received
✅ [FINALIZE] Finalizing items...
✅ [DELIVERY] Sending items to user
```

#### In Dashboard:
1. Go to **Dashboard → Orders**
2. Should see new order with:
   - Order ID: `ORD-{timestamp}-{userId}`
   - Status: Paid ✅
   - Items: ytbg (1) ✅
   - Total: Amount paid ✅

#### In Midtrans Dashboard:
- Payment: Settlement ✅
- Webhook notifications: Last status success ✅ (not "Mengirim Ulang")

---

## 📋 What Changed

| Table | Before | After |
|-------|--------|-------|
| **users** | RLS enabled, auth.uid() required | RLS disabled (service role can insert) |
| **orders** | Strict auth.uid() check | Permissive (any authenticated user) |
| **order_items** | Strict auth.uid() check | Permissive (any authenticated user) |
| **products** | Only active products | Active for read, permissive for write |
| **product_items** | Strict conditions | Permissive read/write |

---

## 🔐 Security Notes

⚠️ **Important**: This removes some RLS restrictions. For production:

1. **Option A: Keep Users RLS disabled** ✅ Recommended
   - Bot needs to create users without auth
   - Users can't see each other's orders (handled in app logic)

2. **Option B: Create bot-specific policy** (More secure)
   ```sql
   -- If bot service role has specific name
   CREATE POLICY "users_bot_insert" ON users
     FOR INSERT
     TO service_role
     WITH CHECK (true);
   ```

3. **Option C: Use JWT tokens for bot**
   - Create JWT token for bot as specific user_id
   - More complex but most secure

**Recommendation**: Use Option A for now, users data is non-sensitive (just Telegram info)

---

## 🚨 If Still Not Working

Check these:

1. **Verify migration ran:**
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '%auth%';
   -- Should return 0 rows (all removed)
   ```

2. **Check users table RLS:**
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables 
   WHERE tablename = 'users';
   -- Should show: users | false
   ```

3. **Check bot logs for new errors:**
   ```bash
   tail -f logs/bot.log
   ```

4. **Check database connection:**
   ```bash
   npm run test-supabase-connection
   ```

---

## 📞 Rollback (if needed)

If something breaks, rollback to migration 003:

```sql
-- In Supabase SQL Editor
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- Then re-run migration 003 policies
```

---

## ✨ Next Steps After Fix

1. ✅ Test payment flow end-to-end
2. ✅ Verify orders appear in dashboard
3. ✅ Check Midtrans webhooks are processed
4. ✅ Verify items delivered to user
5. ⏭️ Monitor logs for any new errors
6. ⏭️ Set up automated testing for payment flow
