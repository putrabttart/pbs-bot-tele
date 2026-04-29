# Deploy ke Railway — PBS Digital Store (Monorepo)

## Arsitektur Deploy

Proyek ini di-deploy sebagai **monorepo** di Railway dengan **3 service terpisah** dalam 1 project:

```
Railway Project: "independent-bravery"
│
├── Service: bot-telegram      (Node.js)
│   └── Custom Domain: bot-pbs.putrabttstorebot.my.id
│
├── Service: dashboard         (Next.js 16)
│   └── Railway URL: *.up.railway.app
│
└── Service: user-store        (Next.js 14) [opsional]
    └── Railway URL: *.up.railway.app
```

Semua service share **1 repo GitHub** yang sama, tapi masing-masing punya **Root Directory** berbeda di Railway.

---

## Setup Railway (Per Service)

### 1. Bot Telegram

| Setting | Value |
|---------|-------|
| **Root Directory** | `bot-telegram` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Watch Paths** | `bot-telegram/**` |

**Environment Variables:**
```env
# Telegram
TELEGRAM_BOT_TOKEN=<dari @BotFather>
TELEGRAM_ADMIN_IDS=<user_id admin, pisah koma>

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=<anon key>

# Midtrans
MIDTRANS_SERVER_KEY=<server key>
MIDTRANS_IS_PRODUCTION=true

# Server
HTTP_PORT=3000
PUBLIC_BASE_URL=https://<bot-domain>.railway.app
WEBHOOK_SECRET=<secret yang sama dengan dashboard>

# Payment
PAYMENT_TTL_MS=900000

# Store
STORE_NAME=Nama Toko
STORE_DESCRIPTION=Deskripsi Toko
SUPPORT_CONTACT=@username
CATALOG_BANNER_URL=<url gambar banner>

# Features
ENABLE_PROMO=true
ENABLE_REFERRAL=true
ENABLE_ANALYTICS=true
ENABLE_FAVORITES=true
ITEMS_PER_PAGE=10
GRID_COLS=5
CURRENCY=IDR
LOCALE=id-ID
```

> **Catatan:** Bot tidak perlu build step karena pure Node.js (bukan TypeScript/Next.js).

---

### 2. Admin Dashboard

| Setting | Value |
|---------|-------|
| **Root Directory** | `dashboard` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Watch Paths** | `dashboard/**` |

**Environment Variables:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# App URL (Railway auto-generates, atau custom domain)
NEXT_PUBLIC_APP_URL=https://<dashboard-domain>.up.railway.app

# Bot connection (untuk trigger refresh dari dashboard ke bot)
NEXT_PUBLIC_BOT_URL=https://<bot-domain>.railway.app
WEBHOOK_SECRET=<secret yang sama dengan bot>
```

> **PENTING:** `NEXT_PUBLIC_BOT_URL` harus menunjuk ke URL bot yang bisa diakses. Jika bot punya custom domain, gunakan itu. Jika tidak, gunakan Railway URL bot.

> **PENTING:** `WEBHOOK_SECRET` harus **sama persis** antara bot dan dashboard agar dashboard bisa trigger bot refresh.

---

### 3. User Web Store (Opsional)

| Setting | Value |
|---------|-------|
| **Root Directory** | `user` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Watch Paths** | `user/**` |

**Environment Variables:**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Midtrans
MIDTRANS_SERVER_KEY=<server key>
MIDTRANS_CLIENT_KEY=<client key>
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=<client key>
MIDTRANS_IS_PRODUCTION=true

# Telegram (untuk notifikasi admin)
TELEGRAM_BOT_TOKEN=<sama dengan bot>
TELEGRAM_ADMIN_IDS=<sama dengan bot>

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=<api key>
RESEND_FROM_NAME=Nama Toko
RESEND_FROM_EMAIL=order@domain.com
```

---

## Langkah Deploy Step-by-Step

### A. Setup Awal (Pertama Kali)

1. **Buat Project di Railway**
   - Buka https://railway.app → New Project → Deploy from GitHub repo
   - Pilih repo `bot-telegram-pbs`

2. **Buat 3 Service dari 1 Repo**
   - Railway akan auto-detect dan buat 1 service
   - Klik **"+ New"** → **"GitHub Repo"** → pilih repo yang sama
   - Ulangi untuk service ke-3 (jika perlu user store)
   - Rename masing-masing service: `bot-telegram`, `dashboard`, `user-store`

3. **Set Root Directory per Service**
   - Klik service `bot-telegram` → Settings → **Root Directory** → `bot-telegram`
   - Klik service `dashboard` → Settings → **Root Directory** → `dashboard`
   - Klik service `user-store` → Settings → **Root Directory** → `user`

4. **Set Build & Start Commands**
   - Lihat tabel di atas untuk masing-masing service

5. **Set Environment Variables**
   - Klik service → Variables → tambahkan semua env vars
   - **PENTING:** Setelah bot di-deploy dan punya URL, update `NEXT_PUBLIC_BOT_URL` di dashboard

6. **Set Custom Domain (opsional)**
   - Bot: Settings → Networking → Custom Domain
   - Dashboard: Settings → Networking → Custom Domain

### B. Re-deploy (Update Kode)

Cukup push ke GitHub — Railway auto-deploy berdasarkan **Watch Paths**:
- Push perubahan di `bot-telegram/` → hanya bot yang re-deploy
- Push perubahan di `dashboard/` → hanya dashboard yang re-deploy
- Push perubahan di `user/` → hanya user store yang re-deploy

### C. Manual Deploy

Dari Railway dashboard: klik service → Deployments → **Deploy** (atau Redeploy).

---

## Troubleshooting

### Build Dashboard Gagal

```
Missing script: "build:dashboard"
```
**Penyebab:** Railway menjalankan build dari root, bukan dari `dashboard/`.
**Solusi:** Pastikan **Root Directory** di Railway service settings = `dashboard` (bukan root).

### Bot Tidak Menerima Refresh dari Dashboard

```
⚠️ Bot refresh failed (timeout)
```
**Penyebab:** `NEXT_PUBLIC_BOT_URL` di dashboard env tidak benar.
**Solusi:**
1. Cek URL bot di Railway → service bot → Settings → Networking
2. Update `NEXT_PUBLIC_BOT_URL` di dashboard env vars
3. Pastikan `WEBHOOK_SECRET` sama di kedua service

### Dashboard Menampilkan Data Lama

**Penyebab:** Browser cache atau service worker.
**Solusi:** Hard refresh (Ctrl+Shift+R) atau clear cache.

### Stok Bot Tidak Update Setelah Edit di Dashboard

Bot sekarang punya 3 mekanisme auto-refresh:
1. **Supabase Realtime** — update dalam 2 detik setelah DB berubah
2. **Webhook dari dashboard** — update instan saat admin edit di dashboard
3. **Scheduler** — auto-refresh setiap 5 menit (fallback)

Jika tetap tidak update, cek:
- Bot logs: apakah ada error Realtime subscription?
- Dashboard logs: apakah bot refresh berhasil?
- Env vars: apakah `WEBHOOK_SECRET` sama?

---

## Diagram Koneksi Antar Service

```
┌──────────────────┐     webhook/refresh     ┌──────────────────┐
│    Dashboard      │ ───────────────────────→│   Bot Telegram   │
│  (Next.js 16)    │     POST + secret       │  (Node.js)       │
│                   │                          │                   │
│  Port: 3000      │                          │  Port: 3000      │
│  Root: dashboard/ │                          │  Root: bot-telegram/│
└────────┬─────────┘                          └────────┬─────────┘
         │                                              │
         │  Supabase SDK                    Supabase SDK + Realtime
         │                                              │
         └──────────────┐          ┌────────────────────┘
                        ▼          ▼
                ┌──────────────────────┐
                │   Supabase Database  │
                │   (PostgreSQL)       │
                │                      │
                │  products            │
                │  product_items       │
                │  orders              │
                │  users               │
                │  settings            │
                └──────────────────────┘
```
