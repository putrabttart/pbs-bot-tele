# PRODUCTION DEPLOYMENT QUICK START

**Status:** 🟢 ALL SECURITY PATCHES DEPLOYED (Feb 23, 2026)  
**Ready for:** Production go-live  
**Owner:** Security Team  

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Pre-Deployment (5 min)
```bash
cd user/
npm run build          # Verify no TypeScript errors
npm run lint           # Check for issues (optional)
```

✅ **Must confirm:** No build errors

### Step 2: Database Migrations (2 min)
Run in Supabase SQL editor:

```sql
-- Create fraud_logs if missing
CREATE TABLE IF NOT EXISTS fraud_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  expected_amount INTEGER,
  received_amount INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Add index for fast queries
CREATE INDEX IF NOT EXISTS idx_fraud_logs_created ON fraud_logs(created_at DESC);

-- Verify tables exist
SELECT COUNT(*) FROM fraud_logs;  -- Should work
```

✅ **Must confirm:** fraud_logs table exists

### Step 3: Deploy to Production
Use your deployment method (Vercel/Railway/Docker):

```bash
# Example for Vercel:
vercel --prod

# Example for Railway:
railway deploy --environment production

# Example for Docker:
docker build -t bot-telegram-pbs:latest .
docker push your-registry/bot-telegram-pbs:latest
```

### Step 4: Verify Deployment (2 min)
After deployment completes:

```bash
# Test checkout endpoint
curl https://your-domain.com/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product":{"kode":"TEST","harga":1},"quantity":1}],"customerName":"Test","customerEmail":"test@test.com","customerPhone":"081234567890"}'

# Should NOT return amount: 1 (should be from DB)
```

### Step 5: Update Midtrans Webhook URL (1 min)
In Midtrans Dashboard:

1. Go to **Settings → Snap Preference → Webhook Configuration**
2. Set Notification URL to:
   ```
   https://your-domain.com/api/webhook
   ```
3. Enable: Finish Payment, Unfinish Payment, Deny Payment
4. **Save**

✅ **Must confirm:** Webhook URL updated

---

## 📊 MONITORING SETUP (Do This Immediately!)

### Real-Time Fraud Detection Query
Add to your monitoring dashboard or run daily:

```sql
-- Fraud attempts in last 24 hours
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  type,
  COUNT(*) as attempts,
  SUM(expected_amount - received_amount) as total_loss_prevented
FROM fraud_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), type
ORDER BY hour DESC;
```

**Alert if:** `attempts > 5` in any hour

### Order Quality Check Query
Run every 4 hours:

```sql
-- Check for suspicious orders
SELECT order_id, total_amount, status, created_at
FROM orders
WHERE (total_amount < 1000 OR total_amount = 1)  -- Suspiciously low
  AND created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;
```

**Alert if:** Any rows returned

### Webhook Success Rate Query
Monitor webhook health:

```sql
-- Webhook processing rate
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_orders,
  SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_orders,
  ROUND(100.0 * SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) / COUNT(*), 2) as pay_rate
FROM orders
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

**Alert if:** `pay_rate < 95%` (possible webhook issues)

---

## 🚨 CRITICAL SETTINGS TO VERIFY

### Environment Variables (in production)
```
✅ NEXT_PUBLIC_SUPABASE_URL        → Set
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY   → Set
✅ SUPABASE_SERVICE_ROLE_KEY       → Set (SECRET, not exposed)
✅ MIDTRANS_SERVER_KEY             → Set (SECRET)
✅ MIDTRANS_CLIENT_KEY             → Set (public OK)
```

❌ **NEVER put SERVICE_ROLE_KEY in public code!**

### Rate Limiting
- Default: 5 requests/minute per IP in `/api/checkout`
- If too strict: Adjust line 15 in `user/app/api/checkout/route.ts`
- If seeing rate limit errors in prod logs: Increase to 10

---

## ✅ POST-DEPLOYMENT CHECKLIST

### Hour 1 (Immediate)
- [ ] Check server logs: No errors
- [ ] Test order flow: Create test order
- [ ] Verify webhook received payment notification
- [ ] Check fraud_logs table: Should be empty (no fraud)
- [ ] Verify order status updated to "paid"

### Hour 2-4 (First few hours)
- [ ] Monitor fraud_logs: Should stay small
- [ ] Check pay_rate query: Should be ≥95%
- [ ] Monitor server resources: CPU/Memory normal
- [ ] Check database performance: No slow queries

### Day 1 (Full day)
- [ ] Review all orders created: All amounts reasonable
- [ ] Check error logs: No spike in webhook failures
- [ ] Verify customer payments received in Midtrans
- [ ] Run security verification: `bash verify-security-patches.sh`

### Week 1
- [ ] Run full security audit: Review all changes working
- [ ] Check converted customers: Conversion rate normal
- [ ] Monitor payment success: Should be >98%

---

## 🔄 WHAT CHANGED (Summary)

### Vulnerability #1: Order Tampering ✅ FIXED
**Before:** Client price trusted → Rp1 orders possible  
**After:** Database price fetched, client input ignored  
**File:** `user/app/api/checkout/route.ts` (lines 100-127)

### Vulnerability #2: Webhook No Validation ✅ FIXED
**Before:** No amount check → pays Rp1 marked as paid  
**After:** Amount validated vs database before fulfillment  
**File:** `user/app/api/webhook/route.ts` (lines 79-93)

### Vulnerability #3: QR in URL ✅ FIXED
**Before:** QR string exposed in address bar  
**After:** QR fetched from secure API endpoint  
**Files:** 
- `user/app/checkout/page.tsx` (removed from redirect)
- `user/app/order-pending/page.tsx` (fetches from API)
- `user/app/api/order/[orderId]/route.ts` (NEW endpoint)

### Vulnerability #4: No Rate Limiting ✅ FIXED
**Before:** Unlimited requests → possible DoS  
**After:** 5 requests/minute per IP  
**File:** `user/app/api/checkout/route.ts` (lines 14-31)

### Vulnerability #5: Fulfillment Without Validation ✅ FIXED
**Before:** Product delivered immediately on webhook  
**After:** Product only delivered after amount verified  
**File:** `user/app/api/webhook/route.ts` (lines 79-165)

---

## 🚨 IF SOMETHING GOES WRONG

### Problem 1: "Too many requests" errors
**Solution:** Rate limit too strict, adjust in `checkout/route.ts` line 15
```typescript
const maxPerMinute = 10;  // Change from 5 to 10
```

### Problem 2: Webhook not calling fulfillment
**Solution:** Check Midtrans webhook configuration
1. Go to Midtrans dashboard
2. Verify notification URL is correct
3. Check server logs for webhook receipt: `console.log('Webhook received')`

### Problem 3: "Amount mismatch" rejections
**Solution:** Possible database sync issue
1. Check order exists in orders table
2. Verify total_amount field exists
3. Restart server to clear in-memory cache

### Problem 4: QR not showing on order page
**Solution:** Check `/api/order/:id` endpoint
1. Verify new endpoint deployed: `ls user/app/api/order/[orderId]/route.ts`
2. Check Midtrans API key valid
3. Test endpoint: `curl https://domain/api/order/TEST-ID`

### Problem 5: Rollback needed
**Solution:** Revert to previous version
```bash
# Restore from backup (if created)
cp *.backup /actual/locations/

# OR from git
git revert HEAD --no-edit

# Redeploy
vercel --prod  # or your deploy command
```

---

## 📞 ESCALATION PATH

**Severity 1 (Critical):** Rp1 orders appearing, payment not processing  
→ Slack: #security-alerts + Message: @devops-lead  
→ Action: Rollback ASAP  

**Severity 2 (High):** Webhook failures, rate limiting too strict  
→ Slack: #payment-issues  
→ Action: Check logs, adjust settings  

**Severity 3 (Medium):** QR not showing, edge cases  
→ Slack: #support  
→ Action: Debug or mark as known issue  

---

## 📋 SIGN-OFF

**Deployed By:** ____________________  
**Date/Time:** ____________________  
**Verified By:** ____________________

✅ **Production Status:** LIVE

---

## 📌 QUICK REFERENCE

| Component | Status | Command |
|-----------|--------|---------|
| Checkout API | ✅ Secure | `POST /api/checkout` |
| Webhook Handler | ✅ Amount validated | `POST /api/webhook` |
| Order API | ✅ New endpoint | `GET /api/order/:id` |
| Frontend | ✅ No QR in URL | `order-pending?orderId=...` |
| Database | ✅ fraud_logs tracking | `SELECT * FROM fraud_logs` |

**Last Updated:** Feb 23, 2026  
**Patches Applied:** 5  
**Production Ready:** YES ✅
