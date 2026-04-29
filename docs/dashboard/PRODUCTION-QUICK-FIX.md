# ⚡ QUICK FIX - Production Login Redirect

## 🎯 Problem
Login works but stuck (no redirect to dashboard)

## ✅ Fix in 3 Minutes

### 1️⃣ Supabase Settings
```
https://supabase.com/dashboard
→ Project: jhrxusliijrgrulrwxjk
→ Settings → Authentication

Site URL: https://independent-bravery-production.up.railway.app
Redirect URLs:
  - https://independent-bravery-production.up.railway.app/
  - https://independent-bravery-production.up.railway.app/auth/callback
  - https://independent-bravery-production.up.railway.app/dashboard

Save changes ✅
```

### 2️⃣ Railway Variables
```
https://railway.app/dashboard
→ independent-bravery → dashboard service
→ Variables

Add/Verify:
NEXT_PUBLIC_SUPABASE_URL=https://jhrxusliijrgrulrwxjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dFStk0P7p2RhCFAOVTi6lA_8502zEzK
NEXT_PUBLIC_APP_URL=https://independent-bravery-production.up.railway.app
```

### 3️⃣ Redeploy
```
Railway → dashboard → Deployments
Click ⋮ menu → Redeploy latest
Wait 2-3 minutes
```

## 🧪 Test
```
https://independent-bravery-production.up.railway.app/login
Email: admin@pbs.com
Password: ****
Sign In → Should redirect to /dashboard ✅
```

---

## 🆘 If Still Not Working

1. **F12 Console** → Check for error logs
2. **Check Supabase Site URL** is exactly: `https://independent-bravery-production.up.railway.app`
3. **Check all URLs match** (case sensitive!)
4. **Redeploy again** if you changed anything

**Detailed guide:** See [PRODUCTION-SETUP-RAILWAY.md](PRODUCTION-SETUP-RAILWAY.md)
