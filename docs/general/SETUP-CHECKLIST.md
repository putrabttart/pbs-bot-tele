# ✅ Setup Checklist - PBS Complete System

Ikuti checklist ini untuk setup lengkap sistem PBS.

## 📋 Pre-Setup

- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Code editor (VS Code recommended)
- [ ] Terminal/Command Prompt

---

## 🗄️ 1. Database Setup (Supabase)

- [ ] Buat account di [Supabase](https://supabase.com)
- [ ] Create new project
- [ ] Copy Project URL
- [ ] Copy Anon/Public Key
- [ ] Run migrations (via SQL Editor):
  - [ ] `001_initial_schema.sql`
  - [ ] `002_product_items.sql`
  - [ ] `003_fix_foreign_keys.sql`
  - [ ] `004_fix_rls_policies.sql`
  - [ ] `005_settings_table.sql`
  - [ ] `006_decrement_stock_function.sql`
- [ ] Verify tables created (products, orders, users, etc.)

📖 **Guide**: `supabase/README.md`

---

## 💳 2. Payment Setup (Midtrans)

- [ ] Daftar di [Midtrans](https://midtrans.com)
- [ ] Activate Sandbox environment
- [ ] Copy Server Key (dari Settings > Access Keys)
- [ ] Copy Client Key (dari Settings > Access Keys)
- [ ] (Optional) Activate Production untuk live

📖 **Guide**: https://docs.midtrans.com

---

## 🤖 3. Telegram Bot Setup

- [ ] Buka [@BotFather](https://t.me/BotFather) di Telegram
- [ ] Create new bot dengan `/newbot`
- [ ] Copy Bot Token
- [ ] Set bot commands (optional):
  ```
  /start - Mulai bot
  /catalog - Lihat katalog
  /help - Bantuan
  ```

### Install & Configure:

```bash
cd bot-telegram
npm install
```

- [ ] Create `.env` file
- [ ] Add environment variables:
  ```env
  TELEGRAM_BOT_TOKEN=your_token
  SUPABASE_URL=your_url
  SUPABASE_ANON_KEY=your_key
  MIDTRANS_SERVER_KEY=your_key
  MIDTRANS_CLIENT_KEY=your_key
  MIDTRANS_IS_PRODUCTION=false
  BOT_MODE=polling
  ```

### Test Bot:

```bash
node index.js
```

- [ ] Bot starts without errors
- [ ] Open bot di Telegram
- [ ] Test `/start` command
- [ ] Test browse catalog

✅ **Bot working!**

📖 **Full Guide**: `bot-telegram/README.md`

---

## 📊 4. Admin Dashboard Setup

```bash
cd dashboard
npm install
```

- [ ] Create `.env.local` file
- [ ] Add environment variables:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=your_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
  ```

### Run Dashboard:

```bash
npm run dev
```

- [ ] Dashboard starts on http://localhost:3000
- [ ] Open in browser
- [ ] Dashboard loads without errors
- [ ] Can view products page
- [ ] Can view orders page

### Add Test Product:

- [ ] Click "Add Product"
- [ ] Fill form (name, price, stock, etc.)
- [ ] Save product
- [ ] Product appears in list
- [ ] Product visible di bot

✅ **Dashboard working!**

📖 **Full Guide**: `dashboard/README.md`

---

## 🛍️ 5. User Web Store Setup

```bash
cd user
npm install
```

### Auto Setup:

```bash
# This will copy env from bot/dashboard
npm run copy-env
```

- [ ] `.env.local` created
- [ ] Edit `.env.local`:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=your_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
  MIDTRANS_SERVER_KEY=your_server_key
  MIDTRANS_CLIENT_KEY=your_client_key
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_client_key
  MIDTRANS_IS_PRODUCTION=false
  ```

### Run Store:

```bash
npm run dev
```

- [ ] Store starts on http://localhost:3001
- [ ] Open in browser
- [ ] Products load correctly
- [ ] Can view product detail
- [ ] Can add to cart
- [ ] Cart badge updates
- [ ] Can view cart page

### Test Checkout:

- [ ] Add product to cart
- [ ] Click "Lanjut ke Pembayaran"
- [ ] Fill form (nama, email, phone)
- [ ] Click "Bayar Sekarang"
- [ ] Midtrans Snap popup muncul
- [ ] QR Code QRIS displayed
- [ ] (Sandbox) Use simulator to test payment
- [ ] Success page shows
- [ ] Stock decrements in database

✅ **Store working!**

📖 **Full Guide**: `user/README.md` & `USER-STORE-README.md`

---

## 🔗 6. Integration Test

### Test Bot → Database → Dashboard:

- [ ] Add product via Dashboard
- [ ] Product visible di Bot
- [ ] Order via Bot
- [ ] Order visible di Dashboard

### Test Store → Database → Dashboard:

- [ ] Browse products di Store
- [ ] Products match Dashboard
- [ ] Order via Store
- [ ] Order visible di Dashboard
- [ ] Stock updated in Dashboard

### Test Complete Flow:

**Via Bot:**
1. [ ] Customer opens bot
2. [ ] Browse & select product
3. [ ] Place order
4. [ ] Pay with QRIS
5. [ ] Receive item

**Via Store:**
1. [ ] Customer opens store
2. [ ] Add products to cart
3. [ ] Checkout
4. [ ] Pay with QRIS
5. [ ] See success page

**Admin:**
1. [ ] See orders in Dashboard
2. [ ] Orders from both Bot & Store visible
3. [ ] Stock correctly updated
4. [ ] Analytics show correct data

✅ **Full integration working!**

---

## 🚀 7. Run All Services

### Option 1: One Command

```bash
node start-all.js
```

Ini akan menjalankan:
- [ ] Bot (Telegram)
- [ ] Dashboard (http://localhost:3000)
- [ ] Store (http://localhost:3001)

### Option 2: Separate Terminals

**Terminal 1:**
```bash
cd bot-telegram && node index.js
```

**Terminal 2:**
```bash
cd dashboard && npm run dev
```

**Terminal 3:**
```bash
cd user && npm run dev
```

- [ ] All services running
- [ ] No port conflicts
- [ ] No errors in console

✅ **System fully operational!**

---

## 🎨 8. Customization (Optional)

### Branding:

- [ ] Change bot name & username
- [ ] Upload bot profile picture
- [ ] Customize bot description
- [ ] Update store name in code
- [ ] Update favicon & logo

### Styling:

- [ ] Customize colors in `tailwind.config.ts`
- [ ] Update theme in Dashboard
- [ ] Change button styles
- [ ] Adjust spacing & fonts

### Features:

- [ ] Enable/disable features in config
- [ ] Add custom product fields
- [ ] Customize payment methods
- [ ] Add shipping options (if needed)

---

## 🔐 9. Security Check

- [ ] `.env` files NOT committed to git
- [ ] `.env.local` NOT committed to git
- [ ] Sensitive data in environment variables
- [ ] RLS policies enabled in Supabase
- [ ] API keys are correct type (anon/service)
- [ ] Server keys only in backend
- [ ] Client keys OK for frontend

### Verify .gitignore:

```bash
git status
# Should NOT show .env or .env.local files
```

✅ **Security configured!**

---

## 📱 10. Production Preparation

### Switch to Production:

- [ ] Get production Midtrans keys
- [ ] Update all `.env` files:
  ```env
  MIDTRANS_IS_PRODUCTION=true
  MIDTRANS_SERVER_KEY=prod_key
  MIDTRANS_CLIENT_KEY=prod_key
  ```
- [ ] Update Snap URL in Store:
  ```typescript
  // In user/app/checkout/page.tsx
  src="https://app.midtrans.com/snap/snap.js"  // Remove 'sandbox.'
  ```

### Deployment:

- [ ] **Bot**: Deploy to Railway/Heroku/VPS
  - [ ] Set environment variables
  - [ ] Change to webhook mode (if using)
  - [ ] Set webhook URL in Telegram
  - [ ] Test bot works in production

- [ ] **Dashboard**: Deploy to Vercel
  - [ ] Connect GitHub repo
  - [ ] Set environment variables
  - [ ] Deploy
  - [ ] Test access

- [ ] **Store**: Deploy to Vercel
  - [ ] Connect GitHub repo
  - [ ] Set environment variables
  - [ ] Deploy
  - [ ] Test full flow

### Domain Setup (Optional):

- [ ] Point domain to Vercel
- [ ] Enable SSL
- [ ] Update CORS settings if needed

### Final Tests:

- [ ] Test bot in production
- [ ] Test dashboard in production
- [ ] Test store with real payment (small amount)
- [ ] Verify webhooks working
- [ ] Check analytics data

✅ **Production ready!**

📖 **Deployment Guides**:
- Bot: `bot-telegram/README.md`
- Dashboard: `dashboard/README.md`
- Store: `user/SETUP-GUIDE.md`

---

## 📊 11. Monitoring Setup (Optional)

- [ ] Setup error logging (Sentry)
- [ ] Monitor uptime (UptimeRobot)
- [ ] Setup analytics (Google Analytics)
- [ ] Enable Supabase monitoring
- [ ] Setup Midtrans notifications

---

## 🎉 12. Launch!

### Pre-launch Checklist:

- [ ] All systems tested
- [ ] Test data cleared (if needed)
- [ ] Real products added
- [ ] Payment tested with small amount
- [ ] Bot commands work
- [ ] Dashboard accessible
- [ ] Store fully functional
- [ ] Support channels ready

### Launch:

- [ ] Announce to customers
- [ ] Share bot link
- [ ] Share store URL
- [ ] Monitor first orders
- [ ] Be ready for support

✅ **You're live! 🚀**

---

## 📝 Post-Launch

### Regular Maintenance:

- [ ] Monitor orders daily
- [ ] Check stock levels
- [ ] Respond to customer inquiries
- [ ] Update products as needed
- [ ] Check analytics weekly
- [ ] Backup database regularly

### Updates:

- [ ] Update dependencies monthly
- [ ] Check for security updates
- [ ] Add new features as needed
- [ ] Optimize based on analytics

---

## 🆘 Quick Links

- 📖 **Getting Started**: `GETTING-STARTED.md`
- 🏗️ **Project Structure**: `PROJECT-STRUCTURE.md`
- 🛍️ **Store Guide**: `USER-STORE-README.md`
- 🤖 **Bot Guide**: `bot-telegram/README.md`
- 📊 **Dashboard Guide**: `dashboard/README.md`
- 🗄️ **Database Guide**: `supabase/README.md`

---

## ✅ Summary

Jika semua checklist di atas ✅, maka:

1. ✅ Database configured & migrated
2. ✅ Bot running & functional
3. ✅ Dashboard accessible & working
4. ✅ Store deployed & tested
5. ✅ Payment integrated & tested
6. ✅ All services integrated
7. ✅ Security configured
8. ✅ Ready for production or already live!

**Congratulations! 🎉**

Sistem PBS Anda sudah complete dan ready to serve customers!

---

**Need help?** Check troubleshooting guides in each component's documentation.

**Happy selling! 🚀💰**
