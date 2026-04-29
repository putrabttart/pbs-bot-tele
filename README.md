# PBS Digital Store v2.0

Monorepo untuk PBS Digital Store yang terdiri dari 3 service utama:

## Struktur Proyek

```
bot-telegram-pbs/
├── bot-telegram/          # Telegram Bot (Node.js + Telegraf + Express)
│   ├── index.js           # Entry point bot
│   ├── src/               # Source code bot
│   │   ├── bot/           # Config, formatters, keyboards, state, handlers
│   │   ├── database/      # Supabase CRUD operations
│   │   ├── payments/      # Midtrans integration
│   │   ├── services/      # Scheduler, backup, settings
│   │   ├── utils/         # Logger, metrics, rate limiter
│   │   ├── data/          # Product & promo data cache
│   │   ├── config/        # Environment loader
│   │   ├── intent/        # Smart intent detection
│   │   └── formatters/    # Transaction formatting
│   ├── scripts/           # Migration & utility scripts
│   ├── data/              # Runtime data (bot-state, settings)
│   ├── backups/           # Compressed backups
│   ├── logs/              # Runtime logs
│   ├── package.json       # Bot dependencies
│   └── .env               # Bot environment config
│
├── dashboard/             # Admin Dashboard (Next.js 16 + React 19)
│   ├── app/               # Next.js app router pages
│   ├── lib/               # Supabase client & types
│   └── package.json       # Dashboard dependencies
│
├── user/                  # User Web Store (Next.js 14 + React 18)
│   ├── app/               # Next.js app router pages
│   ├── components/        # React components
│   ├── lib/               # Supabase client, pricing, email
│   └── package.json       # Store dependencies
│
├── supabase/              # Database schema & migrations (shared)
│   └── migrations/        # SQL migration files (001-012)
│
├── docs/                  # Dokumentasi
│   ├── bot/               # Dokumentasi bot telegram
│   ├── dashboard/         # Dokumentasi admin dashboard
│   ├── user-store/        # Dokumentasi user web store
│   ├── database/          # Dokumentasi database & migrasi
│   └── general/           # Dokumentasi umum proyek
│
├── start-all.js           # Multi-service launcher
└── package.json           # Root package (launcher scripts)
```

## Quick Start

### Menjalankan Semua Service
```bash
node start-all.js
```

### Menjalankan Service Individual
```bash
# Bot Telegram saja
node start-all.js bot
# atau
cd bot-telegram && npm start

# Dashboard saja
node start-all.js dashboard
# atau
cd dashboard && npm run dev

# User Store saja
node start-all.js store
# atau
cd user && npm run dev
```

### Install Dependencies
```bash
# Bot Telegram
cd bot-telegram && npm install

# Dashboard
cd dashboard && npm install

# User Store
cd user && npm install
```

## Teknologi

| Service | Stack | Port |
|---------|-------|------|
| Telegram Bot | Node.js, Telegraf, Express, Supabase | Webhook/Polling |
| Admin Dashboard | Next.js 16, React 19, Tailwind v4 | 3000 |
| User Web Store | Next.js 14, React 18, Tailwind v3 | 3001 |

## Deploy ke Railway

Lihat **[docs/RAILWAY-DEPLOY.md](docs/RAILWAY-DEPLOY.md)** untuk panduan deploy lengkap.

**Ringkasan:** Buat 3 service di 1 Railway project dari repo yang sama, set **Root Directory** per service:

| Service | Root Directory | Build Command | Start Command |
|---------|---------------|---------------|---------------|
| Bot Telegram | `bot-telegram` | `npm install` | `node index.js` |
| Dashboard | `dashboard` | `npm install && npm run build` | `npm run start` |
| User Store | `user` | `npm install && npm run build` | `npm run start` |

## Dokumentasi Lengkap

Lihat folder `docs/` untuk dokumentasi lengkap masing-masing service.
