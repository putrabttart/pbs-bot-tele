# 🚀 Quick Start - Admin Dashboard

## 5-Minute Setup Guide

### Step 1: Create Admin Account in Supabase

1. Open Supabase Dashboard
2. Go to: **Authentication → Users**
3. Click **"Add user"**
4. Enter:
   - Email: `admin@youremail.com`
   - Password: `strong-password-here`
5. Click **"Create user"**

✅ Admin account created!

---

### Step 2: Navigate to Dashboard Directory

```powershell
cd d:\Bot\bot-telegram-pbs\dashboard
```

---

### Step 3: Verify .env.local

Check if `.env.local` exists with:

```
NEXT_PUBLIC_SUPABASE_URL=https://jhrxusliijrgrulrwxjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dFStk0P7p2RhCFAOVTi6lA_8502zEzK
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

✅ If file exists, skip to Step 4

---

### Step 4: Start Dashboard

```powershell
npm run dev
```

**Output:**
```
▲ Next.js 16.1.1
- Local:        http://localhost:3000
```

✅ Dashboard running!

---

### Step 5: Login

1. Open: **http://localhost:3000**
2. You'll be redirected to **http://localhost:3000/login**
3. Enter admin credentials:
   - Email: `admin@youremail.com`
   - Password: `strong-password-here`
4. Click **"Sign In"**

✅ Login successful! Welcome to dashboard 🎉

---

## Next Steps

### ✨ First Time Users:

1. **Products Page** → Add your first product
2. **Product Items Page** → Add sample items
3. **Orders Page** → View order management
4. **Analytics Page** → See dashboard metrics
5. **Settings** → Configure your account

### 📖 Full Documentation:
See [ADMIN-DASHBOARD.md](../ADMIN-DASHBOARD.md) for complete guide.

---

## Common Commands

```powershell
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

---

## Troubleshooting

### Port 3000 already in use?
```powershell
# Use different port
npm run dev -- -p 3001
```

### Clear cache and reinstall
```powershell
rm -r node_modules .next
npm install
npm run dev
```

### Can't login?
1. Check .env.local is configured
2. Verify admin account exists in Supabase
3. Check browser console (F12) for errors

---

## ✅ Checklist

- [ ] Created admin account in Supabase
- [ ] .env.local configured
- [ ] `npm run dev` running
- [ ] Logged in successfully
- [ ] Can see dashboard
- [ ] Added first product
- [ ] Added product items

---

**Status**: Ready to go! 🚀

Your admin dashboard is now operational. Start managing your PBS Bot! 📊
