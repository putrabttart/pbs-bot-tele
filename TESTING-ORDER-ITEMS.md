# 🧪 TESTING GUIDE - Order Items Persistence Fix

## Quick Test (5 minutes)

### Step 1: Rebuild Next.js
```bash
cd d:\Bot\bot-telegram-pbs\user
npm run build
```
**Expected output**: Build completes without errors
**If error**: Check console for TypeScript errors

---

### Step 2: Start Dev Server
```bash
npm run dev
```
**Expected**: Server starts on port 3000
**Example output**:
```
> user@ dev
> next dev

  ▲ Next.js 14.2.3
  ▲ Local:        http://localhost:3000
```

---

### Step 3: Test Webhook with Debug Endpoint
In a new terminal:

```bash
curl -X POST "http://localhost:3000/api/webhook-test?orderId=PBS-TEST-001&amount=50000&status=settlement" ^
  -H "Content-Type: application/json"
```

**Expected response**:
```json
{
  "success": true,
  "message": "Webhook test sent",
  "webhookResponse": {
    "message": "Payment processed"
  }
}
```

**Check console** for:
```
[WEBHOOK] ✅ Found X items to save
[WEBHOOK] Inserting items with order UUID: [UUID here]
[WEBHOOK] ✅ Successfully saved X items
```

---

### Step 4: Verify Database

Open Supabase dashboard and run:

**Check order** (use order_id = "PBS-TEST-001"):
```sql
SELECT id, order_id, status, paid_at, items FROM orders 
WHERE order_id = 'PBS-TEST-001';
```

**Expected result**:
- `id`: Some UUID like `a1b2c3d4-...`
- `order_id`: `PBS-TEST-001`
- `status`: `pending` (webhook test doesn't update)
- `items`: JSON array with products

**Check order_items** (use UUID from above):
```sql
SELECT id, order_id, product_code, product_name, quantity, price FROM order_items 
WHERE order_id = 'a1b2c3d4-...' -- Use UUID from orders.id above;
```

**Expected result**:
```
id                   | order_id             | product_code | product_name        | quantity | price
a1b2d3e4-...        | a1b2c3d4-...        | netflix      | Netflix Premium      | 1        | 100000
```

✅ If you see items here: **THE FIX IS WORKING!**

---

## Full End-to-End Test (10 minutes)

### Step 1-2: Same as Quick Test
(Rebuild and start server)

---

### Step 3: Create Real Order via UI

1. Open http://localhost:3000
2. Add a product to cart
3. Proceed to checkout
4. Fill in customer info
5. **Note the Order ID** shown (PBS-XXXXX)
6. Click "Lanjut Bayar" button

**Expected**:
- QR Code displays
- Order ID shown in browser console
- Redirects to order-pending page
- QR shows (means transaction_id received)

---

### Step 4: Check Checkout Logs

In terminal, look for:
```
[CHECKOUT] ✅ Order created in DB
[CHECKOUT] 📝 Order UUID: [some-uuid]
[CHECKOUT] ✅ Successfully saved X items to order_items table
```

✅ If you see these: Checkout insert is working!

---

### Step 5: Trigger Webhook

Get the **order_id** from URL (e.g., PBS-1771870369795)

```bash
curl -X POST "http://localhost:3000/api/webhook-test?orderId=PBS-1771870369795&amount=100000&status=settlement"
```

**Check console for**:
```
[WEBHOOK] ✅ Found X items to save
[WEBHOOK] Inserting items with order UUID: [uuid-here]
[WEBHOOK] ✅ Successfully saved X items
```

---

### Step 6: Verify Complete Chain

**Query orders table**:
```sql
SELECT id, order_id, status, paid_at FROM orders 
WHERE order_id = 'PBS-1771870369795' LIMIT 1;
```

**Query order_items table**:
```sql
SELECT product_code, product_name, quantity, price FROM order_items 
WHERE order_id = (
  SELECT id FROM orders WHERE order_id = 'PBS-1771870369795' LIMIT 1
);
```

🎉 If order_items has rows: **SUCCESS!**

---

## Troubleshooting

### Problem: Build fails
**Error**: `Type 'string' is not assignable to type 'UUID'`

**Solution**: Check that webhook and checkout files use `createdOrder.id` not `orderId`

```bash
grep -n "order_id: orderId" user/app/api/*.ts
# Should return NOTHING - all should use UUID
```

---

### Problem: Webhook logs show "❌ Failed to insert"
**Error**: 
```
[WEBHOOK] ❌ Items insertion failed:
[WEBHOOK]   Code: 23503
[WEBHOOK]   Message: insert or update on table "order_items" violates foreign key constraint
```

**Cause**: Still passing string instead of UUID

**Check**:
```typescript
// ✅ Should look like:
const itemsToInsert = orderWithItems.items.map((item: any) => ({
  order_id: orderWithItems.id,  // ← Must be orderWithItems.id!
  ...
}))

// ❌ NOT like:
order_id: orderId,  // ← This is string!
```

---

### Problem: "Cannot read property 'id' of null"
**Error**: 
```
TypeError: Cannot read property 'id' of null
```

**Cause**: orderRecord array is empty or null

**Check**:
```bash
# Does order actually get created?
curl http://localhost:3000/api/order/PBS-xxx
# Should return success with order data
```

---

### Problem: order_items table is empty after payment
**Check list**:

1. Was webhook actually called?
   ```bash
   # Look in console for:
   # "=== 🔔 MIDTRANS WEBHOOK RECEIVED ==="
   ```

2. Is order_id field correct?
   ```sql
   -- Check order_items schema
   \d order_items
   -- Should show: order_id | uuid
   ```

3. Is order.id actually a UUID?
   ```sql
   SELECT id, typeof(id) FROM orders WHERE order_id = 'PBS-xxx' LIMIT 1;
   -- Should show: id | uuid (not string!)
   ```

---

## Verification SQL Queries

**Complete verification script**:
```sql
-- 1. Check order exists and has UUID id
SELECT 
  id,
  order_id,
  status,
  total_amount,
  items IS NOT NULL as has_items
FROM orders 
WHERE order_id = 'PBS-1771870369795'
LIMIT 1;

-- 2. Check order_items can be queried by order UUID
SELECT 
  COUNT(*) as item_count,
  STRING_AGG(product_code, ', ') as products
FROM order_items 
WHERE order_id = (
  SELECT id FROM orders WHERE order_id = 'PBS-1771870369795' LIMIT 1
);

-- 3. Check foreign key relationships
SELECT 
  oi.id,
  oi.order_id,
  o.id as "orders.id",
  oi.order_id = o.id as "FK_Valid"
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE o.order_id = 'PBS-1771870369795'
LIMIT 5;
```

---

## Success Indicators ✅

You'll know the fix is working when:

1. **Console shows**:
   ```
   [WEBHOOK] ✅ Successfully saved X items to order_items table
   ```

2. **Supabase query returns items**:
   ```sql
   SELECT * FROM order_items WHERE order_id = [uuid]
   -- Returns 1+ rows with product data
   ```

3. **order_items.order_id is UUID**:
   ```sql
   SELECT order_id FROM order_items LIMIT 1;
   -- Shows: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   -- NOT: PBS-1771870369795
   ```

4. **No FK constraint errors**:
   ```
   Code 23503 should NOT appear in logs
   ```

---

## Final Deployment Checklist

Before going to production:

- [ ] Rebuild completes without TypeScript errors
- [ ] Dev server starts and webhook test succeeds
- [ ] Database shows order_items populated after webhook
- [ ] order_items.order_id values are UUIDs
- [ ] No "FK constraint" errors in logs
- [ ] Do one complete real payment test (1000 Rp order)
- [ ] Verify order-success page shows items list
- [ ] Check logs for all "✅ Successfully saved" messages

---

## Common Fixes Applied

| Component | Fix | Key Change |
|---|---|---|
| **webhook/route.ts** | Line 217 | Use `orderWithItems.id` not `orderId` |
| **checkout/route.ts** | Line 205 | Extract `createdOrder.id` from insert result |
| **Error Logging** | Both files | Added `.details` and `.hint` to error output |
| **Validation** | Both files | Added null checks for fetched orders |

All files updated: ✅

