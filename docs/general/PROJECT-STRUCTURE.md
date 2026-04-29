# 🏗️ Project Structure - PBS Complete System

Sistem PBS terdiri dari 3 komponen utama yang terintegrasi:

## 📦 Components

```
bot-telegram-pbs/
├── 🤖 bot-telegram/          # Telegram Bot untuk customer
├── 📊 dashboard/             # Admin Dashboard (Next.js)
├── 🛍️ user/                  # User Web Store (Next.js) ⭐ NEW
├── 🗄️ supabase/              # Database migrations
├── 📁 src/                   # Shared utilities & services
└── 📁 data/                  # Local data & state
```

## 1️⃣ Bot Telegram (`bot-telegram/`)

**Purpose**: Interface untuk customer via Telegram

**Features**:
- Browse products via bot
- Place orders via chat
- Payment integration
- Order tracking
- Admin notifications

**Tech**: Node.js, Telegraf, Midtrans

**Port**: N/A (Telegram webhook/polling)

**Run**: 
```bash
cd bot-telegram && node index.js
```

---

## 2️⃣ Dashboard Admin (`dashboard/`)

**Purpose**: Admin panel untuk manage products, orders, analytics

**Features**:
- Product CRUD operations
- Order management
- Analytics & reports
- Settings configuration
- User management

**Tech**: Next.js 14, TypeScript, Tailwind CSS, Supabase

**Port**: `3000`

**Run**: 
```bash
cd dashboard && npm run dev
```

**Access**: http://localhost:3000

---

## 3️⃣ User Web Store (`user/`) ⭐ **NEW**

**Purpose**: E-commerce website untuk customer

**Features**:
- Product catalog with filters
- Shopping cart
- Checkout & payment (QRIS)
- Order tracking
- Responsive design

**Tech**: Next.js 14, TypeScript, Tailwind CSS, Supabase, Midtrans

**Port**: `3001`

**Run**: 
```bash
cd user && npm run dev
```

**Access**: http://localhost:3001

---

## 🗄️ Database (Supabase)

**Shared** oleh semua 3 komponen:

### Tables:
- `products` - Katalog produk
- `orders` - Pesanan/transaksi
- `order_items` - Item dalam pesanan
- `users` - Data user/customer
- `settings` - Konfigurasi sistem
- `analytics` - Data analitik

### Files:
```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_product_items.sql
│   ├── 003_fix_foreign_keys.sql
│   ├── 004_fix_rls_policies.sql
│   ├── 005_settings_table.sql
│   └── 006_decrement_stock_function.sql  ⭐ NEW
└── README.md
```

---

## 🔗 Integration Flow

```
┌─────────────────┐
│  Customer       │
└────┬────────────┘
     │
     ├─────────────────┐
     │                 │
     ▼                 ▼
┌─────────┐      ┌──────────┐
│ Telegram│      │ Web Store│
│   Bot   │      │  (User)  │
└────┬────┘      └─────┬────┘
     │                 │
     │    ┌────────────┴──────────┐
     │    │                       │
     ▼    ▼                       ▼
┌─────────────────┐        ┌──────────┐
│    Supabase     │◄───────│ Midtrans │
│    Database     │        │ Payment  │
└────────┬────────┘        └──────────┘
         │
         ▼
┌─────────────────┐
│   Dashboard     │
│    (Admin)      │
└─────────────────┘
```

### Flow Detail:

1. **Admin** manage products via **Dashboard**
2. Products tersimpan di **Supabase**
3. **Customer** bisa order via:
   - **Telegram Bot**, atau
   - **Web Store**
4. Payment diproses via **Midtrans**
5. Order tersimpan di **Supabase**
6. Admin monitor via **Dashboard**

---

## 🚀 Running All Components

### Development Mode (Local)

```bash
# Terminal 1 - Bot Telegram
cd bot-telegram
node index.js

# Terminal 2 - Dashboard
cd dashboard
npm run dev
# Access: http://localhost:3000

# Terminal 3 - User Web Store
cd user
npm run dev
# Access: http://localhost:3001
```

### Production Mode

**Option 1: Separate Deployment**
- Bot → VPS/Heroku/Railway
- Dashboard → Vercel/Netlify
- User Store → Vercel/Netlify

**Option 2: Monorepo**
- Setup Nx/Turborepo
- Deploy all via Railway/Vercel

---

## 📋 Environment Variables

### Shared Across All:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
MIDTRANS_SERVER_KEY=xxx
MIDTRANS_CLIENT_KEY=xxx
```

### Bot Specific:
```env
TELEGRAM_BOT_TOKEN=xxx
```

### Dashboard Specific:
```env
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXTAUTH_SECRET=xxx  # If using auth
```

### User Store Specific:
```env
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=xxx
```

---

## 📊 Feature Comparison

| Feature | Bot | Dashboard | Web Store |
|---------|-----|-----------|-----------|
| Browse Products | ✅ | ✅ | ✅ |
| Place Order | ✅ | ❌ | ✅ |
| Payment | ✅ | ❌ | ✅ |
| Manage Products | ❌ | ✅ | ❌ |
| View Orders | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ❌ |
| User Management | ❌ | ✅ | ❌ |

---

## 🎯 Use Cases

### For Customers:
- **Prefer Telegram?** → Use Bot
- **Prefer Web?** → Use Web Store
- Both save to same database!

### For Admin:
- Manage everything via **Dashboard**
- View orders from both Bot & Web
- Analytics for all channels

---

## 🔐 Security

### Database (Supabase):
- ✅ Row Level Security (RLS) enabled
- ✅ Policies untuk public read, authenticated write
- ✅ API keys di environment variables

### API Keys:
- ✅ Never commit `.env` files
- ✅ Use `.env.local` untuk Next.js
- ✅ Server keys hanya di backend

### Payment:
- ✅ Server Key di backend only
- ✅ Client Key di frontend OK
- ✅ Sandbox untuk testing
- ✅ Production keys untuk live

---

## 📦 Dependencies

### Common:
- `@supabase/supabase-js` - Database client
- `midtrans-client` - Payment gateway

### Bot:
- `telegraf` - Telegram bot framework
- `dotenv` - Environment variables

### Dashboard & User Store:
- `next` - React framework
- `react` - UI library
- `tailwindcss` - Styling
- `typescript` - Type safety

---

## 🛠️ Maintenance

### Update Dependencies:
```bash
# For each component
cd [component]
npm update
```

### Database Migrations:
```bash
# Add new migration
cd supabase/migrations
# Create new .sql file
# Run in Supabase SQL Editor
```

### Backup:
```bash
# Supabase auto-backup daily
# Manual backup via Supabase Dashboard
```

---

## 📚 Documentation

### Per Component:
- `bot-telegram/README.md` - Bot documentation
- `dashboard/README.md` - Dashboard documentation
- `user/README.md` - Web store documentation
- `user/SETUP-GUIDE.md` - Detailed setup
- `user/QUICK-REFERENCE.md` - Quick commands

### Root Level:
- `README.md` - Project overview
- `USER-STORE-README.md` - Web store quick start
- `PROJECT-STRUCTURE.md` - This file

---

## 🎓 Getting Started

### New Developer?

1. **Read** `README.md` di root
2. **Setup** database via `supabase/README.md`
3. **Choose** component to work on:
   - Bot → `cd bot-telegram`
   - Dashboard → `cd dashboard`
   - Web Store → `cd user`
4. **Follow** component's README.md

### Quick Setup All:

```bash
# 1. Install all
npm install --workspaces

# 2. Setup env (manual)
# Copy .env.example to .env for each component

# 3. Run migrations
# Via Supabase Dashboard SQL Editor

# 4. Start services (separate terminals)
cd bot-telegram && node index.js
cd dashboard && npm run dev
cd user && npm run dev
```

---

## 🚀 Deployment

### Recommended Setup:

1. **Database**: Supabase (already hosted)
2. **Bot**: Railway/Heroku/VPS
3. **Dashboard**: Vercel
4. **User Store**: Vercel

### URLs Example:
- Dashboard: `https://admin.yourdomain.com`
- Store: `https://shop.yourdomain.com` or `https://yourdomain.com`
- Bot: Via Telegram (@YourBot)

---

## 🎉 Summary

Project PBS sekarang **complete** dengan 3 komponen:

1. ✅ **Telegram Bot** - Chat interface
2. ✅ **Admin Dashboard** - Management panel
3. ✅ **Web Store** - E-commerce website ⭐ NEW

Semua terintegrasi via **Supabase** database dan **Midtrans** payment!

**Happy coding! 🚀**
