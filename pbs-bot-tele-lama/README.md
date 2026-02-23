# 🤖 PBS Telegram Bot v2.0

Bot Telegram e-commerce modern untuk menjual produk digital dengan Supabase database, Next.js Admin Dashboard, dan Midtrans Payment Gateway.

## ✨ Fitur Utama

### 🛍️ Fitur Pelanggan
- **Katalog Interaktif** - Browse produk dengan pagination dan inline keyboard
- **Pencarian Cepat** - Cari produk by nama, kode, atau kategori
- **Quick Buy** - Format cepat: ketik `KODE JUMLAH` langsung beli
- **Favorit** - Simpan produk favorit untuk akses cepat
- **Riwayat Pembelian** - Lihat history transaksi
- **Real-time Stock** - Info stok real-time dari Supabase database
- **QRIS Payment** - Bayar dengan scan QR (GoPay, OVO, DANA, dll)
- **Auto Delivery** - Item digital dikirim otomatis setelah bayar
- **Product Notes** - Catatan produk (tanggal expired, cara pakai) dikirim ke pembeli

### 👨‍💼 Fitur Admin
- **Next.js Dashboard** - Web dashboard modern untuk manage store
- **Product Management** - CRUD produk dengan kategori dan harga
- **Item Management** - Upload individual items (email/password, voucher codes)
- **Batch Upload** - Upload items massal dari file CSV/TXT
- **Order Monitoring** - Track semua order dengan status real-time
- **User Management** - Lihat dan manage customer database
- **Analytics Dashboard** - Revenue, order count, top products
- **Broadcast Message** - Kirim pengumuman ke semua user
- **Low Stock Alerts** - Notifikasi otomatis stok menipis
- **Auto Refresh** - Dashboard otomatis trigger bot refresh setelah update

### 🔧 Fitur Teknis
- **Supabase Database** - PostgreSQL dengan real-time sync
- **Product Items System** - Individual item tracking (tidak duplikat)
- **Stock Reservation** - Reserve items saat pending payment
- **Webhook Mode** - Support webhook & polling
- **Auto User Tracking** - Semua user otomatis tersimpan di database
- **Payment Polling** - Fallback payment verification
- **Rate Limiting** - Anti-spam dengan cooldown (bypass untuk admin)
- **Metrics & Monitoring** - Prometheus-compatible metrics endpoint
- **Error Handling** - Comprehensive error handling dengan logging
- **Scheduled Jobs** - Auto refresh, cleanup, low stock alerts

## 📋 Prerequisites

- Node.js 18+ 
- Telegram Bot Token (dari @BotFather)
- Supabase account (database & auth)
- Midtrans account untuk payment gateway
- Cloudflare Tunnel atau Ngrok (untuk webhook di local development)

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone <repository-url>
cd bot-telegram-pbs
npm install
```

### 2. Setup Environment

```bash
# Copy .env.example ke .env
copy .env.example .env

# Edit .env dengan konfigurasi Anda
notepad .env
```

### 3. Konfigurasi Required

Edit file `.env` dan isi:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_ADMIN_IDS=123456789,987654321

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Midtrans
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_IS_PRODUCTION=false

# Server
HTTP_PORT=3000
PUBLIC_BASE_URL=https://your-domain.com
WEBHOOK_SECRET=your-webhook-secret-key
SUPPORT_CONTACT=@yourusername
```

### 4. Setup Supabase Database

1. Buat project baru di [Supabase](https://supabase.com)
2. Run migrations di SQL Editor:

```bash
# Run migrations in order
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_product_items.sql
```

Atau copy paste SQL files ke Supabase SQL Editor dan execute.

**Database Schema:**
- `products` - Master data produk
- `product_items` - Individual items (email/password, vouchers, dll)
- `orders` - Order records
- `order_items` - Order detail items
- `users` - Customer database
- `promos` - Promo codes
- `analytics_events` - Event tracking

### 5. Setup Dashboard (Next.js)

```bash
cd dashboard
npm install

# Setup environment
copy .env.example .env.local
# Edit .env.local dengan Supabase credentials

# Run development server
npm run dev
```

Dashboard akan running di `http://localhost:3001`

**Dashboard Features:**
- 📦 Products - Manage produk (add, edit, delete, kategori)
- 🎁 Product Items - Upload items individual atau batch
- 📋 Orders - Monitor semua transaksi
- 👥 Users - Customer database
- 📊 Analytics - Revenue, order stats, top products
- ⚙️ Settings - Bot configuration### 6. Run Bot

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Bot akan running dan siap menerima message!

## 📖 Struktur Project

```
bot-telegram-pbs/
├── bot-telegram/          # Main bot entry point
│   └── index.js          # Bot initialization & launch
├── dashboard/            # Next.js Admin Dashboard
│   ├── app/
│   │   ├── dashboard/   # Dashboard pages
│   │   │   ├── products/   # Product management
│   │   │   ├── items/      # Item management
│   │   │   ├── orders/     # Order monitoring
│   │   │   ├── users/      # User management
│   │   │   ├── analytics/  # Analytics dashboard
│   │   │   └── settings/   # Bot settings
│   │   ├── login/       # Login page
│   │   └── api/         # API routes
│   ├── lib/             # Supabase client
│   └── middleware.ts    # Auth middleware
├── src/
│   ├── bot/              # Bot modules
│   │   ├── config.js     # Configuration management
│   │   ├── state.js      # State management (sessions, orders)
│   │   ├── persistence.js # Auto-save state
│   │   ├── formatters.js # Message formatters
│   │   ├── keyboards.js  # Inline keyboard builders
│   │   └── handlers/     # Request handlers
│   │       ├── commands.js    # Command handlers
│   │       ├── callbacks.js   # Callback query handlers
│   │       ├── purchase.js    # Purchase flow handler
│   │       ├── admin.js       # Admin commands
│   │       └── webhook.js     # Webhook handlers
│   ├── data/             # Data loaders
│   │   ├── products.js   # Product data cache
│   │   ├── promos.js     # Promo codes
│   │   └── payments.js   # Payment logs
│   ├── database/         # Database operations
│   │   ├── supabase.js   # Supabase client
│   │   ├── products.js   # Product CRUD
│   │   ├── product-items.js # Item management
│   │   ├── stock.js      # Stock reservation
│   │   ├── orders.js     # Order management
│   │   ├── users.js      # User management
│   │   ├── analytics.js  # Analytics tracking
│   │   └── promos.js     # Promo management
│   ├── payments/         # Payment integration
│   │   └── midtrans.js   # Midtrans API
│   ├── services/         # External services
│   │   ├── scheduler.js  # Cron jobs
│   │   ├── admin.js      # Admin notifications
│   │   └── backup.js     # Data backup
│   └── utils/            # Utilities
│       ├── logger.js     # Logging utility
│       ├── metrics.js    # Metrics tracking
│       └── rateLimiter.js # Rate limiting
├── supabase/
│   ├── migrations/       # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   └── 002_product_items.sql
│   └── README.md
├── data/                 # Local data files
│   ├── bot-state.json   # Bot state backup
│   └── settings.json    # Settings cache
├── scripts/             # Utility scripts
│   ├── migrate-products-to-supabase.js
│   ├── migrate-state-to-supabase.js
│   └── test-stock-operations.js
├── .env.example          # Environment template
├── package.json          # Dependencies
└── README.md            # Documentation
```

## 🎮 User Commands

```
/start          - Mulai bot dan lihat welcome message
/menu           - Lihat katalog produk
/search <query> - Cari produk
/buy <kode> <qty> - Beli produk langsung
/categories     - Lihat kategori produk
/favorites      - Lihat produk favorit
/history        - Lihat riwayat pembelian
/status <id>    - Cek status order
/help           - Bantuan penggunaan
```

## 👨‍💼 Admin Commands

```
/admin                    - Dashboard admin
/admin help              - Bantuan admin
/admin stats             - Statistik detail
/admin topproducts       - Produk terlaris
/admin users             - Info pengguna
/admin orders            - Order aktif
/admin refresh           - Refresh data produk
/admin health            - Status sistem
/admin broadcast <msg>   - Kirim broadcast
```

## 🌐 Webhook Endpoints

### Bot API Endpoints
```
POST /webhook/telegram      - Telegram webhook
POST /webhook/midtrans      - Midtrans payment webhook
POST /webhook/refresh       - Trigger product refresh (with secret)
POST /webhook/lowstock      - Low stock alert notification
GET  /status               - Bot status & metrics
GET  /health               - Health check
GET  /metrics              - Prometheus metrics
GET  /metrics/json         - Metrics in JSON format
```

### Dashboard API Endpoints
```
POST /api/bot/refresh      - Trigger bot to refresh products
POST /api/auth/login       - Login authentication
GET  /api/products         - Get all products
POST /api/products         - Create new product
PUT  /api/products/:id     - Update product
DELETE /api/products/:id   - Delete product
GET  /api/items            - Get product items
POST /api/items            - Add new item
POST /api/items/batch      - Batch upload items
```

## 🔄 Flow Pembelian

1. **User browse katalog** → Pilih produk dari menu
2. **Lihat detail** → Info lengkap produk + adjust quantity
3. **Klik Buy** → System reserve items di Supabase
4. **Generate QR** → Midtrans QRIS payment
5. **User scan & bayar** → Midtrans webhook notification
6. **Auto finalize** → Mark items as sold, get item data
7. **Delivery** → Bot kirim item digital + notes ke user
8. **Thank you** → Pesan terimakasih & contact support

## 💳 Payment & Stock Flow

```
User Request Purchase
        ↓
Bot → Supabase (Reserve Items)
        ├─ Check available items
        ├─ Reserve for 15 minutes
        └─ Return: OK or insufficient_stock
        ↓
Midtrans API (Create QRIS)
        ├─ Generate QR code
        └─ Return: QR string + URL
        ↓
User Scan QR & Pay
        ↓
Midtrans Webhook → Bot
        ├─ Verify signature
        └─ Check transaction_status
        ↓
Bot → Supabase (Finalize Items)
        ├─ Mark items as sold
        ├─ Get item_data + notes
        └─ Update order status
        ↓
Bot Sends to User:
        ├─ Message 1: Order receipt
        ├─ Message 2: Digital items
        ├─ Message 2.5: Product notes (if any)
        └─ Message 3: Thank you + support
        ↓
Dashboard Auto-Refresh
        └─ Dashboard sees updated stock
```

## 🛠️ Database Schema

### Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  kode VARCHAR(50) UNIQUE,
  nama VARCHAR(255),
  harga DECIMAL(15,2),
  kategori VARCHAR(100),
  deskripsi TEXT,
  stok INTEGER,
  aktif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Product Items Table
```sql
CREATE TABLE product_items (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  product_code VARCHAR(50),
  item_data TEXT,              -- Actual data (email:pass, voucher code)
  notes TEXT,                  -- Important notes (expired date, instructions)
  batch VARCHAR(50),           -- Batch identifier
  status VARCHAR(20),          -- available, reserved, sold, invalid
  order_id VARCHAR(50),        -- Order that purchased this
  sold_to_user_id BIGINT,
  sold_at TIMESTAMPTZ,
  reserved_for_order VARCHAR(50),
  reserved_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Key Features:
- ✅ Individual item tracking (no duplicate delivery)
- ✅ Stock reservation system (15 min timeout)
- ✅ Automatic stock sync dengan product table
- ✅ Order tracking per item
- ✅ Batch upload support

## 📦 Upload Items ke Dashboard

### Method 1: Manual Add (Single Item)
1. Buka Dashboard → Product Items
2. Select product
3. Klik "Add Items"
4. Input item data (e.g., `email@example.com:password123`)
5. (Optional) Add notes (e.g., `Expired: 31 Dec 2026`)
6. Save

### Method 2: Batch Upload (Multiple Items)
1. Buka Dashboard → Product Items
2. Select product
3. Klik "Upload Batch"
4. Prepare file dengan format:
   ```
   email1@example.com:password123
   email2@example.com:password456
   email3@example.com:password789
   ```
5. Upload file
6. Bot auto-refresh setelah upload

**Supported Formats:**
- Plain text (one item per line)
- CSV format
- `||` separator untuk multi-field items

**Item Data Examples:**
```
Email & Password:
user@gmail.com:mypassword123

Voucher Code:
VOUCHER-ABC-123-XYZ

License Key:
XXXX-XXXX-XXXX-XXXX

Multi-field (with || separator):
Email: user@test.com||Password: pass123||Pin: 1234
```

## 🎨 Customization

### Ubah Tampilan

Edit `src/bot/formatters.js`:
- `formatProductList()` - Format list produk
- `formatProductDetail()` - Format detail produk
- `formatOrderReceipt()` - Format struk pembayaran

### Ubah Keyboard

Edit `src/bot/keyboards.js`:
- `productGridKeyboard()` - Grid nomor produk
- `productDetailKeyboard()` - Tombol di detail produk
- `mainMenuKeyboard()` - Main menu keyboard

### Tambah Command

Edit `bot-telegram/index.js`:
```javascript
bot.command('mycommand', async (ctx) => {
  await ctx.reply('My custom command!');
});
```

## 📊 Analytics

Bot menyimpan analytics di Supabase:
- Total orders & revenue
- Product views counter
- Search queries log
- User activity tracking
- Daily/monthly statistics
- Top selling products
- Revenue trends

**Access via:**
- `/admin stats` - Bot command untuk admin
- Dashboard Analytics page - Web interface dengan charts

## 🔄 Background Jobs (Scheduler)

Bot menjalankan scheduled jobs otomatis:

| Job | Interval | Deskripsi |
|-----|----------|-----------|
| Product Refresh | 30 min | Refresh product data dari Supabase |
| Low Stock Alert | 60 min | Notifikasi admin jika stok < 5 |
| Cleanup | 24 jam | Hapus expired reservations & old data |
| Metrics Update | 60 min | Update analytics metrics |

Jobs bisa di-configure di `src/services/scheduler.js`

## 🔒 Security

- ✅ Signature verification untuk Midtrans webhook
- ✅ Secret key untuk webhook authentication
- ✅ Admin-only commands dengan ID whitelist
- ✅ Rate limiting untuk prevent spam (admin bypass)
- ✅ Input validation & sanitization
- ✅ Supabase Row Level Security (RLS)
- ✅ Dashboard authentication dengan Supabase Auth
- ✅ CORS protection untuk API endpoints
- ✅ SQL injection prevention dengan parameterized queries

## 🚀 Deployment

### Deploy Bot (Railway/Heroku)

1. Push code ke Git repository
2. Connect repository ke Railway/Heroku
3. Set environment variables di platform
4. Deploy!

**Environment variables yang dibutuhkan:**
```
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_IDS
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MIDTRANS_SERVER_KEY
MIDTRANS_IS_PRODUCTION
PUBLIC_BASE_URL
WEBHOOK_SECRET
HTTP_PORT
```

### Deploy Dashboard (Vercel/Netlify)

1. Push dashboard folder ke Git
2. Connect ke Vercel/Netlify
3. Set build command: `npm run build`
4. Set output directory: `.next`
5. Add environment variables
6. Deploy!

**Dashboard environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_BOT_URL
WEBHOOK_SECRET
```

## 🐛 Troubleshooting

### Bot tidak respond
- Check bot token valid di `.env`
- Verify webhook URL accessible (untuk webhook mode)
- Check firewall/port
- Test dengan polling mode dulu

### Produk tidak muncul
- Check Supabase connection
- Verify `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`
- Run migration files di Supabase SQL Editor
- Check products table ada data

### Dashboard tidak bisa login
- Check Supabase Auth enabled
- Verify email confirmation settings
- Check `.env.local` variables correct
- Clear browser cache/cookies

### Payment tidak success
- Check Midtrans credentials
- Verify webhook endpoint accessible
- Check webhook signature
- Test dengan Midtrans sandbox dulu

### Items tidak terkirim
- Check `product_items` table ada data available
- Verify status items = 'available'
- Check logs: `[FINALIZE ERROR]` messages
- Ensure items uploaded ke product yang benar

### Stock tidak update di dashboard
- Check auto-refresh setelah add/edit items
- Verify `NEXT_PUBLIC_BOT_URL` di dashboard `.env.local`
- Check bot `/webhook/refresh` endpoint accessible
- Manual refresh: `/admin refresh`

### Order stuck di pending
- Check Midtrans payment status di dashboard
- Items auto-release setelah 15 menit
- Manual release via Supabase: update `product_items.status = 'available'`

## 🔧 Development Tips

### Local Development dengan Webhook

Gunakan Cloudflare Tunnel atau Ngrok:

```bash
# Ngrok
ngrok http 3000

# Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000
```

Update `PUBLIC_BASE_URL` dengan URL yang didapat.

### Testing Payment Flow

1. Gunakan Midtrans Sandbox
2. Set `MIDTRANS_IS_PRODUCTION=false`
3. Test card numbers: https://docs.midtrans.com/en/technical-reference/sandbox-test
4. Mock webhook untuk testing:
   ```bash
   curl -X POST http://localhost:3000/webhook/midtrans \
     -H "Content-Type: application/json" \
     -d '{"order_id":"ORD-123","transaction_status":"settlement"}'
   ```

### Database Migrations

Untuk add/modify tables:

1. Buat file baru di `supabase/migrations/`
2. Numbering: `003_your_migration.sql`
3. Run di Supabase SQL Editor
4. Update `database.types.ts` jika perlu

### Monitoring & Logs

- Bot logs: console output atau `logs/` folder
- Metrics: `http://localhost:3000/metrics`
- Supabase logs: Supabase Dashboard → Logs
- Order tracking: Dashboard → Orders page

## 📝 License

MIT License - Feel free to use and modify

## 👥 Support

- 📧 Email: support@pbsstore.com
- 💬 Telegram: @pbssupport
- 📖 Docs: https://docs.pbsstore.com

## 🙏 Credits

Built with:
- [Telegraf](https://github.com/telegraf/telegraf) - Telegram bot framework
- [Next.js](https://nextjs.org/) - React framework untuk dashboard
- [Supabase](https://supabase.com/) - PostgreSQL database & authentication
- [Express](https://expressjs.com/) - Web server
- [Midtrans](https://midtrans.com/) - Payment gateway
- [QRCode](https://www.npmjs.com/package/qrcode) - QR code generation
- [Node-cron](https://www.npmjs.com/package/node-cron) - Scheduled jobs

## 📚 Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Development guide
- [MIGRATION-SUPABASE.md](MIGRATION-SUPABASE.md) - Migration dari Google Sheets
- [STOCK-MANAGEMENT.md](STOCK-MANAGEMENT.md) - Stock system documentation
- [dashboard/README.md](dashboard/README.md) - Dashboard documentation

## 🆕 Recent Updates

### v2.0 (January 2026)
- ✅ Migrated from Google Sheets to Supabase
- ✅ Added Next.js Admin Dashboard
- ✅ Individual item tracking system (product_items)
- ✅ Stock reservation with 15-min timeout
- ✅ Auto user tracking on every interaction
- ✅ Product notes delivery to buyers
- ✅ Dashboard-triggered bot refresh
- ✅ Fixed callback error handling
- ✅ Batch item upload
- ✅ Enhanced metrics & monitoring
- ✅ Scheduled background jobs

### Migration Notes
Legacy Google Sheets code has been removed. If you need to migrate existing data, see [MIGRATION-SUPABASE.md](MIGRATION-SUPABASE.md).

---

**Made with ❤️ for PBS Digital Store**
