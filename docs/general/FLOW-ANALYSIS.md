# 📊 Complete Flow Analysis: Bot vs Web Store

## 🤖 BOT TELEGRAM FLOW (WORKING)

### 1️⃣ Order Creation (src/bot/handlers/purchase.js - Line 41-110)

```
handlePurchase()
├─ Generate orderId: PBS-${hash} ← using timestamp + userId
├─ Reserve stock: reserveStock()
├─ Create Midtrans QRIS: createMidtransQRISCharge()
├─ [CRITICAL] Persist to Supabase:
│  ├─ upsertUser() → users table
│  └─ createOrder() → orders table
│     └─ Payload:
│        ├─ order_id: string
│        ├─ user_id: BIGINT (from ctx.from.id - REQUIRED!)
│        ├─ total_amount: number
│        ├─ payment_url: string
│        ├─ midtrans_token: null
│        ├─ user_ref: `tg:${userId}`
│        ├─ status: 'pending'
│        └─ expired_at: ISO string
│
├─ Generate QR code image
└─ Store in ACTIVE_ORDERS (memory) + start polling

⏰ Order expires after BOT_CONFIG.PAYMENT_TTL_MS (usually 5 minutes)
```

**Key Detail**: Bot inserts `user_id` as required BIGINT from Telegram user.

---

### 2️⃣ Payment Success Flow (src/bot/handlers/purchase.js - Line 222-365)

Triggered by webhook when Midtrans sends `transaction_status: settlement`

```
handlePaymentSuccess(telegram, orderId)
├─ Get order from ACTIVE_ORDERS (memory)
├─ Finalize stock: finalizeStock()
│  └─ Gets digital items from product_items table
├─ Send 3 messages to user:
│  ├─ Message 1: Payment confirmation + receipt
│  ├─ Message 2: Digital items
│  └─ Message 3: Thank you message
│
├─ [CRITICAL] Persist to Supabase:
│  ├─ updateOrderStatus(orderId, 'paid')
│  ├─ createOrderItems(orderId, items) ← SEPARATE TABLE!
│  │  └─ Items structure:
│  │     ├─ order_id: UUID (foreign key to orders.id)
│  │     ├─ product_code: string
│  │     ├─ product_name: string
│  │     ├─ quantity: number
│  │     ├─ price: number
│  │     ├─ product_id: UUID
│  │     └─ item_data: JSON (digital content)
│  ├─ markItemsAsSent(orderId)
│  └─ updateOrderStatus(orderId, 'completed')
│
└─ Delete order from ACTIVE_ORDERS (after 1 hour)
```

**Key Detail**: Items stored in SEPARATE `order_items` TABLE, not as JSONB array!

---

### 3️⃣ Webhook Processing (src/bot/handlers/webhook.js - Line 13-77)

```
Midtrans → POST /webhook
├─ Verify X-Signature header
├─ Check transaction_status
└─ if settlement/capture:
   └─ handlePaymentSuccess() ← calls above flow
```

**Key Detail**: Bot verifies signature using X-Signature header.

---

## 🌐 WEB STORE FLOW (CURRENTLY BROKEN)

### 1️⃣ Checkout/Order Creation (app/api/checkout/route.ts - Line 34-147)

```
POST /api/checkout
├─ Validate items, customer data
├─ Calculate totalAmount
├─ Generate orderId: PBS-${Date.now()} ← different algorithm!
│  └─ NOT using timestamp + userId pattern
│
├─ Create Midtrans QRIS Direct Charge
├─ [BROKEN] Try to INSERT order:
│  └─ Payload (missing user_id!):
│     ├─ order_id: string ✅
│     ├─ transaction_id: string ✅
│     ├─ customer_name: string ✅
│     ├─ customer_email: string ✅
│     ├─ customer_phone: string ✅
│     ├─ total_amount: number ✅
│     ├─ status: 'pending' ✅
│     ├─ payment_method: 'qris' ✅
│     └─ items: JSONB ARRAY ❌ (different structure!)
│        └─ [{product_id, product_name, product_code, qty, price}]
│
│  ❌ ERROR: RLS might block INSERT or field validation fails
│  └─ Log shows: "PGRST116 - The result contains 0 rows"
│     This means .single() found no rows = SELECT after INSERT returned nothing
│
└─ Return QRIS response with items
```

**Problems Identified**:
1. ❌ Trying to store items as JSONB array in orders table (bot uses separate order_items table)
2. ❌ Missing `user_id` field (but web store doesn't have telegram user_id)
3. ❌ Not persisting order data properly to database

---

### 2️⃣ Webhook (app/api/webhook/route.ts - Line 1-77)

```
Midtrans → POST /webhook
├─ Verify signature_key (SHA512)
└─ if capture/settlement:
   ├─ UPDATE orders SET status='paid', paid_at=NOW()
   └─ notifyAdmin() [logging only]
```

**Problem**: If order wasn't inserted in step 1, UPDATE finds 0 rows.

---

### 3️⃣ Order Success Page (app/order-success/page.tsx)

```
GET /order-success?orderId=PBS-XXX
├─ Fetch from /api/orders/[orderId]
│  └─ Query database: SELECT * FROM orders WHERE order_id = ?
│     ❌ RETURNS 0 ROWS (no order found!)
│
└─ Display items from database.items JSONB array
   ❌ Can't display because order not in database!
```

---

## 🔍 ROOT CAUSE ANALYSIS

### Why Orders Aren't Being Saved?

The error log shows:
```
[Order Details] Order not found in database: {
  code: 'PGRST116',
  details: 'The result contains 0 rows',
  ...
}
```

This error occurs at `.single()` in the SELECT after INSERT. This means:

1. ✅ Midtrans QRIS transaction WAS created (payment can happen)
2. ❌ Supabase INSERT of order FAILED or returned no rows
3. The system continues anyway (not failing the payment) - which is correct

**Possible Root Causes**:

A. **RLS Policy Issue**:
   - Policy allows INSERT but maybe requires specific conditions
   - Check: Does ANON_KEY have INSERT permission?
   
B. **Field Validation**:
   - Maybe Supabase rejects the payload due to field types
   - Web store sends `items` as JSONB but maybe schema expects something else
   
C. **Connection Issue**:
   - NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY wrong
   - Network error (but would see different error)

D. **NULL Constraint**:
   - Migration 007 made `user_id` nullable
   - But maybe RLS still requires it?
   - Web store doesn't have user_id (web users don't exist in users table)

---

## ✅ SOLUTION: Match Bot's Exact Pattern

### Key Changes Needed:

1. **Use Same Order ID Pattern**:
   ```typescript
   // Current (WRONG):
   const orderId = `PBS-${Date.now()}`  // Only timestamp
   
   // Should be (LIKE BOT):
   const timestamp = Date.now()
   const hash = (timestamp + someId).toString(36).toUpperCase().slice(-8)
   const orderId = `PBS-${hash}`  // More unique
   ```

2. **Store Items Properly**:
   ```typescript
   // Current (WRONG):
   // Single INSERT with items as JSONB array
   
   // Should be (LIKE BOT):
   // Step A: INSERT into orders table
   // Step B: INSERT into order_items table (separate operation)
   ```

3. **Ensure Supabase Write Succeeds**:
   ```typescript
   // Add retry logic or better error handling
   // Log EVERY step of the database operation
   // Don't silently continue if INSERT fails
   ```

4. **Webhook Match Bot Pattern**:
   ```typescript
   // Current: Manually build SHA512 signature
   // Bot uses: X-Signature header verification
   // Check which format Midtrans actually sends in production
   ```

---

## 📋 DATABASE SCHEMA COMPARISON

### Bot's Schema (orders table):
```sql
orders {
  id: UUID (primary key)
  order_id: VARCHAR(50) UNIQUE
  user_id: BIGINT NOT NULL -- Telegram user ID
  status: VARCHAR(20) -- pending, paid, etc
  total_amount: DECIMAL
  payment_url: TEXT
  midtrans_token: TEXT
  user_ref: VARCHAR(100)
  created_at: TIMESTAMPTZ
  paid_at: TIMESTAMPTZ
}

order_items {  -- SEPARATE TABLE!
  id: UUID
  order_id: UUID (FK to orders.id)
  product_id: UUID
  product_code: VARCHAR(50)
  product_name: TEXT
  quantity: INTEGER
  price: DECIMAL
  item_data: TEXT
  sent: BOOLEAN
  sent_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ
}
```

### Web Store's Schema (migration 007):
```sql
orders {
  -- original fields +
  transaction_id: VARCHAR(100) -- new
  customer_name: VARCHAR(255) -- new
  customer_email: VARCHAR(255) -- new
  customer_phone: VARCHAR(20) -- new
  payment_method: VARCHAR(50) -- new
  items: JSONB -- ARRAY in single field! (DIFFERENT)
}
```

**The Issue**: Web store trying to use different schema than bot!

---

## 🎯 EXACT STEPS TO FIX

### OPTION A: Make Web Store Use Same Schema as Bot

**Pros**:
- Uses exact same database structure as bot
- Reuses order_items table
- Shares business logic

**Cons**:
- Requires web to have user_id (web doesn't have telegram users)
- More complex INSERT (2 operations)

### OPTION B: Keep Web Store's Separate Schema (RECOMMENDED)

**Pros**:
- Web store independent from bot
- Simpler INSERT (single operation)
- Custom schema for web-specific needs

**Cons**:
- Different from bot (but intentional separation)
- need to ensure INSERT actually works

**Implementation**:
1. Debug why current INSERT is failing
2. Maybe issue is RLS or field types
3. Add better logging
4. Test with Supabase CLI if needed

---

## 📝 RECOMMENDED IMPLEMENTATION PATH

Since you said "jangan ubah apapun di bot" (don't change bot):

**WEB STORE SHOULD**:
1. Keep its own orders table schema (with items JSONB)
2. Keep its own order_items separation if needed
3. BUT: Make the INSERT/query logic work properly

**KEY FIX**:
```typescript
// In checkout/route.ts, change from:
const orderPayload = {
  order_id, transaction_id, customer_name, ...items
}

// To use proper database operations like bot does:
// Step 1: Create order entry
await supabase.from('orders').insert({order_id, transaction_id, ...})

// Step 2: Create items (maybe separate or as array)
await supabase.from('order_items').insert(itemsArray)  // if using bot's table
// OR just keep items as JSONB if using web's schema
```

The bot manages items separately because it has complex fulfillment logic.
The web store can keep items as JSONB array - that's fine!
The issue is the INSERT itself is failing.

---

## 🔧 DEBUGGING NEXT STEPS

1. **Check Supabase Logs**:
   - Go to Supabase dashboard
   - Check API logs for failed INSERTs
   - Look for RLS policy rejections

2. **Test Direct Insert**:
   ```typescript
   // In checkout route, test simpler payload:
   const { data, error } = await supabase
     .from('orders')
     .insert({
       order_id: orderId,
       total_amount: totalAmount,
       status: 'pending'
     })
   console.log('INSERT ERROR:', error)
   ```

3. **Check RLS Policies**:
   - Confirm `orders_insert_auth` policy exists
   - Verify `WITH CHECK (true)` is there
   - Test if ANON_KEY works

4. **Verify Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Are they correct?

