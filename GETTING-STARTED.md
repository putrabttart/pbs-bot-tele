# 🚀 PBS Complete System - Quick Start

Sistem PBS terdiri dari **3 komponen utama** yang terintegrasi:

## 🎯 Components Overview

| Component | Description | Port | Access |
|-----------|-------------|------|--------|
| 🤖 **Telegram Bot** | Customer interface via Telegram | N/A | @YourBot |
| 📊 **Admin Dashboard** | Web admin panel | 3000 | http://localhost:3000 |
| 🛍️ **User Web Store** | E-commerce website | 3001 | http://localhost:3001 |

Semua komponen menggunakan **Supabase** database yang sama dan **Midtrans** untuk payment.

---

## ⚡ Super Quick Start

### Option 1: Run All Services

```bash
# Run all services with one command
node start-all.js
```

Ini akan menjalankan:
- Telegram Bot
- Admin Dashboard (http://localhost:3000)
- User Web Store (http://localhost:3001)

### Option 2: Run Individually

```bash
# Terminal 1 - Bot
cd bot-telegram && node index.js

# Terminal 2 - Dashboard
cd dashboard && npm run dev

# Terminal 3 - Web Store
cd user && npm run dev
```

---

## 📦 Setup Each Component

### 1️⃣ Telegram Bot

```bash
cd bot-telegram
npm install

# Setup .env
cp .env.example .env
# Edit .env dengan credentials Anda

# Run
node index.js
```

📖 **Full Guide**: `bot-telegram/README.md`

### 2️⃣ Admin Dashboard

```bash
cd dashboard
npm install

# Setup .env.local
cp .env.example .env.local
# Edit .env.local dengan credentials Anda

# Run
npm run dev
```

🌐 **Access**: http://localhost:3000  
📖 **Full Guide**: `dashboard/README.md`

### 3️⃣ User Web Store ⭐ **NEW**

```bash
cd user
npm install

# Auto copy env dari bot/dashboard
npm run copy-env

# Edit .env.local - tambahkan Midtrans keys
# Dapatkan keys dari: https://dashboard.midtrans.com

# Run
npm run dev
```

🌐 **Access**: http://localhost:3001  
📖 **Full Guide**: `user/README.md` atau `USER-STORE-README.md`

---

## 🔑 Environment Variables

Setiap komponen butuh environment variables. Berikut yang **shared**:

```env
# Supabase (sama untuk semua)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# Midtrans (sama untuk semua)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

**Bot specific**:
```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

**Dashboard & Store** (Next.js format):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

---

## 🗄️ Database Setup

1. Buat project di [Supabase](https://supabase.com)
2. Copy URL dan Anon Key
3. Run migrations:

```bash
# Di Supabase SQL Editor, run files ini secara berurutan:
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_product_items.sql
supabase/migrations/003_fix_foreign_keys.sql
supabase/migrations/004_fix_rls_policies.sql
supabase/migrations/005_settings_table.sql
supabase/migrations/006_decrement_stock_function.sql  # ⭐ NEW untuk web store
```

📖 **Full Guide**: `supabase/README.md`

---

## 🎯 Feature Matrix

| Feature | Bot | Dashboard | Web Store |
|---------|:---:|:---------:|:---------:|
| Browse Products | ✅ | ✅ | ✅ |
| Place Orders | ✅ | ❌ | ✅ |
| Payment (QRIS) | ✅ | ❌ | ✅ |
| Manage Products | ❌ | ✅ | ❌ |
| View Orders | ✅ | ✅ | ⏳ |
| Analytics | ❌ | ✅ | ❌ |
| User Management | ❌ | ✅ | ❌ |
| Stock Management | ❌ | ✅ | ❌ |

---

## 🛍️ Customer Experience

Customers bisa order via **2 cara**:

### Via Telegram Bot:
1. Open @YourBot di Telegram
2. Browse katalog
3. Pilih produk
4. Bayar dengan QRIS
5. Terima item otomatis

### Via Web Store:
1. Buka http://yourstore.com
2. Browse katalog
3. Add to cart
4. Checkout & bayar QRIS
5. Konfirmasi pembayaran

**Kedua cara tersimpan di database yang sama!**

---

## 👨‍💼 Admin Workflow

1. Login ke **Dashboard** (http://localhost:3000)
2. **Add products** di Products page
3. **Upload items** (untuk digital products)
4. **Monitor orders** di Orders page
5. **View analytics** di Analytics page
6. Orders dari **Bot** dan **Web Store** muncul di sini!

---

## 📱 Testing

### Test Bot:
1. Buka Telegram
2. Start @YourBot
3. Browse & order produk
4. Test payment (sandbox)

### Test Dashboard:
1. Buka http://localhost:3000
2. Add test product
3. Upload items
4. Check orders

### Test Web Store:
1. Buka http://localhost:3001
2. Browse products
3. Add to cart
4. Checkout & test payment

---

## 🚀 Deployment

### Recommended Setup:

- **Database**: Supabase (already cloud)
- **Bot**: Railway / Heroku / VPS
- **Dashboard**: Vercel
- **Web Store**: Vercel

### Quick Deploy:

```bash
# Dashboard & Store (Vercel)
vercel --prod

# Bot (Railway)
railway up
```

📖 **Deployment Guides**:
- Bot: `bot-telegram/README.md#deployment`
- Dashboard: `dashboard/README.md#deployment`
- Store: `user/SETUP-GUIDE.md#production-deployment`

---

## 📚 Documentation

### Getting Started:
- 📄 **THIS FILE** - Quick start untuk semua
- 📘 `PROJECT-STRUCTURE.md` - Struktur project lengkap
- 🛍️ `USER-STORE-README.md` - Web store quick guide

### Per Component:
- 🤖 `bot-telegram/README.md` - Bot documentation
- 📊 `dashboard/README.md` - Dashboard documentation
- 🛍️ `user/README.md` - Web store main docs
- 📝 `user/SETUP-GUIDE.md` - Detailed setup & troubleshooting
- ⚡ `user/QUICK-REFERENCE.md` - Commands cheat sheet

### Database:
- 🗄️ `supabase/README.md` - Database setup & migrations
- 🔐 `supabase/RLS-FIX-GUIDE.md` - Security policies

---

## 🎓 Learning Path

### For Beginners:
1. ✅ Read this file
2. ✅ Setup database (`supabase/README.md`)
3. ✅ Choose 1 component to start:
   - Bot (easiest)
   - Dashboard (medium)
   - Web Store (medium)
4. ✅ Follow component's README

### For Developers:
1. ✅ Read `PROJECT-STRUCTURE.md`
2. ✅ Setup all 3 components
3. ✅ Test integration flow
4. ✅ Customize as needed

---

## 🐛 Troubleshooting

### Common Issues:

**Port conflicts?**
```bash
# Change ports in package.json
Dashboard: "dev": "next dev -p 3002"
Store: "dev": "next dev -p 3003"
```

**Database connection fails?**
- Check Supabase URL & keys
- Verify RLS policies
- Check internet connection

**Payment not working?**
- Verify Midtrans keys (sandbox/production)
- Check browser console for errors
- Test with Midtrans simulator

📖 **Full troubleshooting**: `user/SETUP-GUIDE.md#troubleshooting`

---

## 🆘 Need Help?

1. Check component-specific README
2. Read troubleshooting guides
3. Check browser/terminal console
4. Verify environment variables
5. Check Supabase logs

---

## ⭐ What's New in v2.1

- ✨ **User Web Store** - E-commerce website untuk customers
- ✨ **Shopping Cart** - Add multiple products
- ✨ **QRIS Payment** - Midtrans Snap integration
- ✨ **Auto Stock Decrement** - Stock update otomatis
- ✨ **Responsive Design** - Mobile-friendly UI
- ✨ **One-command Start** - Run all services dengan `node start-all.js`

---

## 🎉 Quick Commands

```bash
# Install all dependencies
npm install --workspaces

# Run all services
node start-all.js

# Run specific service
node start-all.js bot        # Bot only
node start-all.js dashboard  # Dashboard only
node start-all.js store      # Store only

# Setup web store
cd user && npm run setup

# Copy environment variables
cd user && npm run copy-env
```

---

## 📞 Support

- 🤖 Bot Issues: See `bot-telegram/README.md`
- 📊 Dashboard Issues: See `dashboard/README.md`
- 🛍️ Store Issues: See `user/SETUP-GUIDE.md`
- 🗄️ Database Issues: See `supabase/README.md`

---

## ✅ Checklist

Before going live:

- [ ] Database migrations completed
- [ ] All environment variables set
- [ ] Bot tested end-to-end
- [ ] Dashboard accessible
- [ ] Web store tested
- [ ] Payment working (test then prod)
- [ ] RLS policies verified
- [ ] Production keys configured
- [ ] Deployed to hosting
- [ ] Domain configured (if any)

---

## 🎊 You're Ready!

Semua komponen siap digunakan! 

**Start with**: `node start-all.js`

**Happy selling! 🚀**
