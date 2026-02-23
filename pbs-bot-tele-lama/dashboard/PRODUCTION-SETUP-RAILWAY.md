# 🚀 Production Setup - Railway Dashboard Login

## 🎯 Problem
Login works locally but redirect stuck on production (Railway)

## ✅ Solution: 3 Steps

### STEP 1: Fix Supabase Settings (CRITICAL)

**Important:** Supabase Site URL must match your dashboard URL exactly!

1. Go: https://supabase.com/dashboard
2. Project: `jhrxusliijrgrulrwxjk`
3. **Settings** → **Authentication** tab

#### A. Update Site URL
- Find: **"Site URL"** field (top section)
- Change to: `https://independent-bravery-production.up.railway.app`
- Click **"Save changes"**

#### B. Verify Redirect URLs
- Find: **"Redirect URLs"** section (below Site URL)
- Must have these 3 URLs:
  ```
  https://independent-bravery-production.up.railway.app/
  https://independent-bravery-production.up.railway.app/auth/callback
  https://independent-bravery-production.up.railway.app/dashboard
  ```
- If missing, click **"Add URL"** and add them
- Click **"Save changes"**

---

### STEP 2: Configure Railway Environment

1. Go: https://railway.app/dashboard
2. Project: `independent-bravery`
3. Click **dashboard** service (not the bot)
4. Go to **Variables** tab
5. Make sure these exist and are correct:

```
NEXT_PUBLIC_SUPABASE_URL=https://jhrxusliijrgrulrwxjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dFStk0P7p2RhCFAOVTi6lA_8502zEzK
NEXT_PUBLIC_APP_URL=https://independent-bravery-production.up.railway.app
```

**If `NEXT_PUBLIC_APP_URL` missing:**
1. Click **"New Variable"**
2. Name: `NEXT_PUBLIC_APP_URL`
3. Value: `https://independent-bravery-production.up.railway.app`
4. Save

---

### STEP 3: Redeploy Dashboard

1. Railway → **dashboard** service
2. Go to **Deployments** tab
3. Click menu button (⋮) on latest deployment
4. Click **"Redeploy latest"**
5. Wait ~2-3 minutes for build to complete
6. Status should show **"Success"** ✅

---

## 🧪 Test After Deployment

1. Open: https://independent-bravery-production.up.railway.app/login
2. Email: `admin@pbs.com`
3. Password: (your password)
4. Click **Sign In**
5. Should redirect to: `/dashboard` automatically ✅

---

## 🔍 Debug If Still Not Working

### Check 1: Browser Console
1. F12 → Console tab
2. Look for logs with emoji
3. Should see: `🔐 LOGIN SUCCESS` if working
4. If error, read the error message carefully

### Check 2: Check Cookies
1. F12 → Application tab
2. Go to **Cookies** section
3. Look for cookie starting with `sb-`
4. If empty = session not created

### Check 3: Network Tab
1. F12 → Network tab
2. Click Sign In
3. Look for requests to Supabase API
4. Check response status (should be 200, not 401/403)

### Check 4: Verify All URLs Match
```
Supabase Site URL:         https://independent-bravery-production.up.railway.app
Supabase Redirect URLs:    https://independent-bravery-production.up.railway.app/*
Railway App URL:           https://independent-bravery-production.up.railway.app
Your Browser URL:          https://independent-bravery-production.up.railway.app/login

✅ ALL MUST MATCH EXACTLY
```

---

## 🚨 Common Issues & Fixes

### Issue: "Redirect URL mismatch"
**Cause:** Supabase redirect URL doesn't match your login URL

**Fix:**
1. Go to Supabase → Authentication Settings
2. Check all Redirect URLs exactly match dashboard URL
3. Case sensitive!

---

### Issue: Login succeeds but no redirect
**Cause:** Environment variable `NEXT_PUBLIC_APP_URL` not set

**Fix:**
1. Railway → dashboard variables
2. Add: `NEXT_PUBLIC_APP_URL=https://independent-bravery-production.up.railway.app`
3. Redeploy

---

### Issue: "Invalid redirect_uri" error
**Cause:** Site URL in Supabase is wrong

**Fix:**
1. Supabase → Settings → Authentication
2. Check **Site URL** is: `https://independent-bravery-production.up.railway.app`
3. Not the root URL, but your dashboard URL exactly

---

### Issue: Cookies show as empty
**Cause:** Supabase auth callback failed

**Fix:**
1. Check Redirect URLs in Supabase
2. Make sure includes: `/auth/callback`
3. Redeploy dashboard

---

## ✅ Checklist Before Test

- [ ] Supabase Site URL = `https://independent-bravery-production.up.railway.app`
- [ ] Supabase Redirect URLs include:
  - [ ] `https://independent-bravery-production.up.railway.app/`
  - [ ] `https://independent-bravery-production.up.railway.app/auth/callback`
  - [ ] `https://independent-bravery-production.up.railway.app/dashboard`
- [ ] Railway NEXT_PUBLIC_SUPABASE_URL = `https://jhrxusliijrgrulrwxjk.supabase.co`
- [ ] Railway NEXT_PUBLIC_SUPABASE_ANON_KEY = correct key
- [ ] Railway NEXT_PUBLIC_APP_URL = `https://independent-bravery-production.up.railway.app`
- [ ] Dashboard redeployed after changes

---

## 🎉 Success Signs

✅ When working:
1. Can login with email/password
2. Immediately redirects to `/dashboard`
3. Sidebar loads with menu
4. Can see Products, Orders, etc.
5. Logout works

---

## 📝 Summary

**The Key Issue:** Supabase needs to know where your dashboard is hosted, and it needs to match exactly.

**The Fix:** Set Site URL + Redirect URLs in Supabase to your exact Railway dashboard URL.

**Then:** Redeploy and test!

Good luck! 🚀
