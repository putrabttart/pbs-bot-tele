# MANUAL SECURITY VERIFICATION CHECKLIST

## Pre-Production Verification Steps

### Phase 1: Code Review (5-10 min)
- [ ] Review `/user/app/api/checkout/route.ts`
  - [ ] Lines 100-127: Database product lookup (NOT client price)
  - [ ] Lines 14-31: Rate limiting function exists
  - [ ] Lines 113-115: Stock validation from DB
  - [ ] Response does NOT contain qrString or qrUrl
  
- [ ] Review `/user/app/api/webhook/route.ts`
  - [ ] Lines 67-78: Fetch order from DB
  - [ ] Lines 79-93: Amount validation logic (gross_amount === dbTotal)
  - [ ] Lines 40-48: Fraud logging when mismatch detected
  - [ ] Fulfillment ONLY happens after amount validated
  
- [ ] Review `/user/app/checkout/page.tsx`
  - [ ] QR string NOT in redirect URL
  - [ ] Uses `router.push(/order-pending?orderId=...)`
  
- [ ] Review `/user/app/order-pending/page.tsx`
  - [ ] Uses `useEffect` to fetch QR from `/api/order/:id`
  - [ ] QR taken from API response, not URL params
  
- [ ] Review `/user/app/api/order/[orderId]/route.ts`
  - [ ] New endpoint exists
  - [ ] Fetches order from DB
  - [ ] Returns QR from Midtrans only if order pending

---

### Phase 2: Database Verification (5 min)
Run these SQL queries in Supabase:

```sql
-- Check fraud_logs table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'fraud_logs';

-- Create if missing:
CREATE TABLE IF NOT EXISTS fraud_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  type TEXT NOT NULL,
  expected_amount INTEGER,
  received_amount INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Check payment_logs table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'payment_logs';

-- Verify products table has 'harga' column
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'products' AND column_name = 'harga';
```

**Checklist:**
- [ ] fraud_logs table exists
- [ ] payment_logs table exists  
- [ ] products.harga column exists
- [ ] orders.total_amount column exists

---

### Phase 3: Environment Variables (2 min)
Verify these are set in `.env.local` (user/ directory):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  (ONLY used server-side now)
MIDTRANS_SERVER_KEY=...
MIDTRANS_CLIENT_KEY=...
```

- [ ] All variables set
- [ ] SERVICE_ROLE_KEY is confidential (not in client code)
- [ ] No secrets in public environment variables

---

### Phase 4: Manual API Testing (10-15 min)

#### Test 4a: Checkout with Tampered Price ❌ SHOULD FAIL
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "product": {
        "kode": "PRODUCT-123",
        "harga": 1,
        "nama": "iPhone"
      },
      "quantity": 1
    }],
    "customerName": "Test",
    "customerEmail": "test@test.com",
    "customerPhone": "081234567890"
  }'
```

**Expected:**
- Response amount > 1 (from database)
- NOT "amount": 1
- QR string NOT in response

- [ ] Amount is from database, not client (Rp > 1)
- [ ] QR not in response
- [ ] No errors

#### Test 4b: Webhook with Mismatched Amount ❌ SHOULD BE REJECTED
```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ORDER-TEST-123",
    "gross_amount": "1",
    "status_code": "200",
    "transaction_status": "settlement",
    "signature_key": "YOUR_SIGNATURE_HERE"
  }'
```

**Expected:**
- Status: 400 Bad Request
- Message: "Amount mismatch" or similar
- NO product fulfillment

- [ ] Webhook rejected (400 error)
- [ ] Fraud logged to fraud_logs table
- [ ] NO order updated to paid
- [ ] NO product marked as sold

#### Test 4c: Rate Limiting ❌ SHOULD BLOCK 6th REQUEST
Rapid-fire 6 requests to /api/checkout within 60 seconds

**Expected:**
- Requests 1-5: Success (200)
- Request 6: 429 Too Many Requests or error

- [ ] Rate limiting active
- [ ] Blocks after 5 requests/minute

#### Test 4d: Order Pending Page & QR Fetch ✅ SHOULD WORK
```javascript
// In browser console on http://localhost:3000/order-pending?orderId=TEST-123
fetch('/api/order/TEST-123')
  .then(r => r.json())
  .then(data => console.log(data))
```

**Expected:**
- Returns JSON with order and QR data
- QR NOT in URL bar
- QR NOT in page HTML source

- [ ] API endpoint responds
- [ ] QR returned from backend
- [ ] QR not in URL

---

### Phase 5: Transaction Flow Test (Real Midtrans) (15-20 min)

#### Requirements:
- [ ] User store app running (npm run dev)
- [ ] Midtrans Sandbox account active
- [ ] Notification URL in Midtrans dashboard points to your webhook

#### Steps:
1. [ ] Go to http://localhost:3000 (user dashboard)
2. [ ] Select product with normal price (NOT Rp1)
3. [ ] Proceed to checkout
4. [ ] Fill customer info
5. [ ] Submit checkout form
6. [ ] Verify in Supabase: New order created with correct amount
7. [ ] Scan QR or click Midtrans link
8. [ ] Complete payment in Midtrans sandbox
9. [ ] Verify webhook received and processed
10. [ ] Check order status updated to "paid"
11. [ ] Verify product marked as "sold"
12. [ ] Check fraud_logs table is empty (no fraud detected)

**Checklist:**
- [ ] Order created with DB price
- [ ] QR usable
- [ ] Payment processed
- [ ] Webhook succeeded (200 OK in logs)
- [ ] Order marked paid
- [ ] Product delivered
- [ ] NO fraud logs

---

### Phase 6: Security Hardening Checklist (5 min)

- [ ] Webhook signature verification working (intact from original)
- [ ] No console.log of sensitive data (payment amounts, tokens)
- [ ] Email validation in checkout (prevents typos)
- [ ] Stock decrements atomically (no double-sells)
- [ ] Only DB prices used, client input ignored
- [ ] QR not logged anywhere visible
- [ ] Fraud logs created for suspicious transactions

---

### Phase 7: Deployment Readiness (5 min)

Before pushing to production:

- [ ] All TypeScript compiles without errors
- [ ] No warnings in build: `npm run build`
- [ ] Environment variables prepared for production
- [ ] Midtrans webhook URL updated (if using different domain)
- [ ] Database migrations run: fraud_logs, payment_logs tables exist
- [ ] Backup of current database created
- [ ] Rollback procedure documented
- [ ] Monitoring setup: Check fraud_logs table daily
- [ ] Alert system (optional): Email/Slack on fraud detected

---

## Quick Verification Commands

### Check patch files deployed:
```bash
# User app patches
ls -la user/app/api/checkout/route.ts       # Should be patched version
ls -la user/app/api/webhook/route.ts        # Should be patched version
ls -la user/app/checkout/page.tsx           # Should be patched version
ls -la user/app/order-pending/page.tsx      # Should be patched version
ls -la user/app/api/order/[orderId]/route.ts # Should exist (NEW)
```

### Verify no Rp1 orders in last 24 hours:
```sql
SELECT COUNT(*) as rp1_orders
FROM orders 
WHERE total_amount = 1 
  AND created_at > NOW() - INTERVAL '24 hours';
-- Result should be: 0
```

### Check fraud_logs for unauthorized attempts:
```sql
SELECT order_id, type, expected_amount, received_amount, created_at
FROM fraud_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## Rollback Procedure (If Issues)

If you need to rollback to previous version:

```bash
# Option 1: From git (if previous committed)
git checkout HEAD~1 user/app/api/checkout/route.ts
git checkout HEAD~1 user/app/api/webhook/route.ts
# ... etc for other files
npm run build
npm run deploy

# Option 2: From backup file
cp user/app/api/checkout/route.ts.backup user/app/api/checkout/route.ts
cp user/app/api/webhook/route.ts.backup user/app/api/webhook/route.ts
# ... etc
npm run build
npm run deploy
```

---

## Sign-Off

**Security Verification Completed By:** ________________  
**Date:** ________________  
**Approved for Production:** ☐ YES / ☐ NO

**Issues Found:** _________________________________
**Notes:** _________________________________

---

## Success Criteria

✅ All tests passed  
✅ No Rp1 orders  
✅ Webhook validating amounts  
✅ Rate limiting active  
✅ QR secure (not in URL)  
✅ Database prices enforced  
✅ Fraud logging working  

**Status: READY FOR PRODUCTION** 🚀
