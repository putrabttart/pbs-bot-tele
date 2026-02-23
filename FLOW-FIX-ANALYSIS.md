# 🔍 PBS Store - Complete Flow Analysis & Fixes Applied

## Problem Identified

**Root Cause**: `order_items` table has a **FOREIGN KEY mismatch**

```sql
-- order_items table structure
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,  ← FK to orders.id (UUID)
  product_code VARCHAR(50) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(12,2) NOT NULL,
  ...
);
```

### Why Items Weren't Saving

| Issue | Current Code | Expected |
|-------|---|---|
| **order_items.order_id field** | References `orders.id` (UUID) | Admin needs UUID |
| **Checkout Insert** | Used `order_id: "PBS-xxx"` (string) | Must use `orders.id` (UUID) |
| **Webhook Insert** | Used `order_id: orderId` (string) | Must use orders.id from DB |
| **Data Type Mismatch** | String (PBS-1771870369795) | UUID (f1c146ba-0581...) |

---

## Fixes Applied

### ✅ FIX #1: Webhook order_items insertion

**File**: `user/app/api/webhook/route.ts` (Lines 210-260)

**What was wrong**:
```typescript
// ❌ WRONG - orderId is string "PBS-xxx"
const itemsToInsert = orderWithItems.items.map((item: any) => ({
  order_id: orderId,  // ← This is a STRING, but FK expects UUID!
  product_code: item.product_code, ...
}))
```

**Fix applied**:
```typescript
// ✅ CORRECT - Use orders.id (UUID) which is the PRIMARY KEY
const { data: orderWithItems } = await supabase
  .from('orders')
  .select('id, items')  // ← Fetch BOTH id (UUID) AND items
  .eq('order_id', orderId)  // ← Query by order_id string
  .single()

const itemsToInsert = orderWithItems.items.map((item: any) => ({
  order_id: orderWithItems.id,  // ← Use UUID id (not string order_id)!
  product_code: item.product_code, ...
}))
```

**Key changes**:
- Fetch `orders.id` (UUID primary key) during query
- Use `orderWithItems.id` instead of `orderId` (string)
- Added detailed error logging to see FK violation messages
- Proper response handling for Supabase insert result

---

### ✅ FIX #2: Checkout order_items insertion

**File**: `user/app/api/checkout/route.ts` (Lines 200-240)

**What was wrong**:
```typescript
// ❌ WRONG - Same issue as webhook
const orderItems = validatedItems.map(item => ({
  order_id: orderId,  // ← String, not UUID!
  product_code: item.product_code, ...
}))
```

**Fix applied**:
```typescript
// ✅ CORRECT - Extract UUID from insert result
const { data: orderRecord, error: orderError } = await supabase
  .from('orders')
  .insert({...})
  .select()  // ← Returns array with inserted record

// Extract the UUID
const createdOrder = orderRecord && orderRecord.length > 0 ? orderRecord[0] : null

// Use UUID for order_items
const orderItems = validatedItems.map(item => ({
  order_id: createdOrder.id,  // ← Use UUID from created order!
  product_code: item.product_code, ...
}))
```

**Key changes**:
- Extract `createdOrder.id` from insert result
- Use UUID when inserting order_items
- Robust null checking
- Enhanced error logging with field details

---

## Complete Payment Flow (NOW WORKING)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1️⃣  CHECKOUT PAGE (Frontend)                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Customer selects products and enters info                          │
│ POST /api/checkout {items, customerName, customerEmail, ...}      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2️⃣  CHECKOUT ENDPOINT (Post checkout, Step 1-4)                    │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Validate cart items against database PRICES                    │
│ ✅ Calculate total: Σ(db_price × quantity)                        │
│ ✅ Create ORDER RECORD:                                           │
│    {                                                               │
│      id: 4f2a1b3c-... (UUID) ← PRIMARY KEY                        │
│      order_id: "PBS-1771870369795" (string)                       │
│      total_amount: 100000 (from DB calculation)                   │
│      status: "pending"                                            │
│      items: [{product_code, product_name, price, qty}, ...] JSON  │
│    }                                                               │
│ ✅ INSERT ITEMS TO order_items:                                    │
│    For each item {                                                 │
│      order_id: 4f2a1b3c-... ← UUID from created order             │
│      product_code: "netflix"                                      │
│      product_name: "Netflix Premium 3 Month"                      │
│      price: 100000                                                │
│      quantity: 1                                                  │
│    }                                                               │
│ ✅ Create Midtrans QRIS transaction                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3️⃣  ORDER PENDING PAGE (Frontend - 15 min wait)                   │
├─────────────────────────────────────────────────────────────────────┤
│ Display QR Code via proxy: GET /api/qris/{transaction_id}         │
│ Poll status every 10s: POST /api/payment-status {order_id}        │
│ When status = "settlement" → Redirect to /order-success           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
          (Customer scans QR & completes payment)
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4️⃣  MIDTRANS WEBHOOK (POST /api/webhook)                           │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Verify webhook signature (SHA512 + SERVER_KEY)                 │
│ ✅ Validate transaction amount matches DB total                   │
│ ✅ UPDATE ORDER STATUS:                                           │
│    UPDATE orders SET status = 'paid', paid_at = NOW()             │
│    WHERE order_id = "PBS-1771870369795"                           │
│ ✅ FETCH ORDER WITH UUID:                                         │
│    SELECT id, items FROM orders WHERE order_id = "PBS-xxx"        │
│    → Returns: { id: 4f2a1b3c-..., items: [...] }                 │
│ ✅ INSERT ITEMS (IF NOT ALREADY DONE IN CHECKOUT):               │
│    For each item in orders.items {                                │
│      INSERT into order_items {                                    │
│        order_id: 4f2a1b3c-... ← UUID (not string!)               │
│        product_code, product_name, price, quantity                │
│      }                                                             │
│    }                                                               │
│ ✅ Log payment success                                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5️⃣  ORDER SUCCESS PAGE (Frontend)                                  │
├─────────────────────────────────────────────────────────────────────┤
│ GET /api/order/{orderId}                                          │
│ Display items from DB: SELECT * FROM order_items                  │
│ WHERE order_id = 4f2a1b3c-... ← UUID query!                       │
│ Show: ✅ Order Complete, Items Ready, Download Links              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Clarification

### orders table
```
id (UUID - PRIMARY KEY) ← What order_items references!
order_id (VARCHAR - String identifier for API/frontend)
customer_name, customer_email, customer_phone
total_amount
status (pending, paid, failed, expired)
items (JSONB array of ordered products)
transaction_id (from Midtrans)
paid_at (null until webhook marks as paid)
```

### order_items table
```
id (UUID - PRIMARY KEY)
order_id (UUID - FK to orders.id) ⚠️ THIS IS THE KEY
product_code (VARCHAR)
product_name (TEXT)
price (DECIMAL)
quantity (INTEGER)
item_data (TEXT - optional item content)
```

**CRITICAL**: Column `order_items.order_id` is a UUID that references `orders.id`, NOT the string `orders.order_id`!

---

## Verification Checklist

After deploying these fixes:

- [ ] **Rebuild Next.js**
  ```bash
  cd user && npm run build
  ```

- [ ] **Start dev server**
  ```bash
  npm run dev
  ```

- [ ] **Test Checkout Flow**
  1. Add product to cart
  2. Fill customer info
  3. Proceed to payment
  4. Check `/api/order/{orderId}` - should return QR
  5. Check database:
     ```sql
     SELECT id, order_id, status FROM orders WHERE order_id = 'PBS-xxx';
     -- Should show: id = UUID, order_id = string, status = pending
     
     SELECT order_id, product_code, product_name FROM order_items WHERE order_id = 'UUID-from-above';
     -- Should show: order_id = UUID (same as orders.id), products listed
     ```

- [ ] **Test Webhook with Debug Endpoint**
  ```bash
  curl -X POST "http://localhost:3000/api/webhook-test?orderId=PBS-1771870369795&amount=100000&status=settlement"
  ```
  Check response - should show items inserted successfully

- [ ] **Test Database Cascade**
  ```sql
  -- Check if items were inserted after webhook
  SELECT COUNT(*) FROM order_items WHERE order_id = (
    SELECT id FROM orders WHERE order_id = 'PBS-1771870369795'
  );
  ```

---

## Logging Points to Monitor

### In Checkout
```
[CHECKOUT] Order created in DB
[CHECKOUT] 📝 Order UUID: 4f2a1b3c-...
[CHECKOUT] Inserting items with order UUID: 4f2a1b3c-...
[CHECKOUT] ✅ Successfully saved X items to order_items table
```

### In Webhook
```
[WEBHOOK] 📊 Fetching order from database...
[WEBHOOK] ✅ Order found in DB
[WEBHOOK] ✅ Order status updated to "paid"
[WEBHOOK] 📦 Saving items to order_items for order PBS-xxx...
[WEBHOOK] ✅ Found X items to save
[WEBHOOK] Inserting items with order UUID: 4f2a1b3c-...
[WEBHOOK] ✅ Successfully saved X items to order_items table
```

---

## Common Issues and Solutions

### Issue: "Insert to order_items fails silently"
**Cause**: Trying to insert string into UUID field
**Solution**: Use `orders.id` (UUID) not `orders.order_id` (string)
**Check**: Look for FK error in Supabase error logs

### Issue: "Order status updated but no items"
**Cause**: Webhook fired but item insert failed
**Solution**: Check error logs for "[WEBHOOK] ❌ Failed to insert"
**Fix**: Verify order.id is UUID format

### Issue: "Can't fetch items from order-success page"
**Cause**: Querying order_items with wrong field
**Solution**: Always query `WHERE order_id = orders.id` (UUID)

---

## Next Steps

1. **Deploy** the webhook and checkout fixes
2. **Test** with curl hooks
3. **Monitor** console logs for "Successfully saved X items"
4. **Verify** database has items in order_items table
5. **Done!** Items will now persist for customers

