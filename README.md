# 🤖 PBS Telegram Bot v2.0

Bot Telegram yang powerful untuk menjual produk digital dengan integrasi Google Sheets dan Midtrans Payment Gateway.

## ✨ Fitur Utama

### 🛍️ Fitur Pelanggan
- **Katalog Interaktif** - Browse produk dengan pagination dan inline keyboard
- **Pencarian Cepat** - Cari produk by nama, kode, atau kategori
- **Quick Buy** - Format cepat: ketik `KODE JUMLAH` langsung beli
- **Favorit** - Simpan produk favorit untuk akses cepat
- **Riwayat Pembelian** - Lihat history transaksi
- **Real-time Stock** - Info stok real-time dari Google Sheets
- **QRIS Payment** - Bayar dengan scan QR (GoPay, OVO, DANA, dll)
- **Auto Delivery** - Akun digital dikirim otomatis setelah bayar

### 👨‍💼 Fitur Admin
- **Dashboard Analytics** - Statistik penjualan real-time
- **Product Management** - Auto-sync dengan Google Sheets
- **Order Monitoring** - Pantau order aktif dan completed
- **Broadcast Message** - Kirim pengumuman ke semua user
- **Low Stock Alerts** - Notifikasi otomatis stok menipis
- **User Analytics** - Track user activity dan behavior

### 🔧 Fitur Teknis
- **Webhook Mode** - Support webhook & polling
- **Auto Refresh** - Produk auto-refresh dari spreadsheet
- **Payment Polling** - Fallback payment verification
- **Rate Limiting** - Anti-spam dengan cooldown
- **Session Management** - User state management
- **Error Handling** - Comprehensive error handling
- **Logging** - Detailed logging untuk debugging

## 📋 Prerequisites

- Node.js 18+ 
- Telegram Bot Token (dari @BotFather)
- Google Sheets untuk data produk
- Google Apps Script untuk stock management
- Midtrans account untuk payment gateway

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
TELEGRAM_ADMIN_IDS=your_telegram_user_id

# Google Sheets (CSV Export URL)
SHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0

# Google Apps Script
GAS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
GAS_SECRET=your-secret-key

# Midtrans
MIDTRANS_SERVER_KEY=your_midtrans_server_key
MIDTRANS_IS_PRODUCTION=false

# Server
HTTP_PORT=3000
PUBLIC_BASE_URL=https://your-domain.com
```

### 4. Setup Google Sheets

Format spreadsheet harus sesuai:

**Sheet: Produk**
| nama | # | harga | ikon | deskripsi | kategori | wa | harga_lama | stok | kode | alias |
|------|---|-------|------|-----------|----------|----|-----------|----- |------|-------|
| Netflix Premium 1 Bulan | 1 | 35000 | 🎬 | Full Garansi||Support Semua Device | Streaming | | 50000 | 0 | netf1b | netflix |

**Sheet: Stok_Lain** (untuk digital items)
| kode | data | status | order_id | buyer_id | created_at | updated_at |
|------|------|--------|----------|----------|------------|------------|
| netf1b | email@gmail.com||Password: pass123 | sold | ORD-1760155004448 | tg:1099822426 | 11/10/2025 | 11/10/2025 |

**Sheet: Order_Log** (untuk tracking)
| order_id | kode | # | qty | total | status | buyer_id | buyer_phone | created_at | paid_at |
|----------|------|---|-----|-------|--------|----------|-------------|------------|---------|
| PBS-175739597832 | netf1b | 1 | 1 | 35000.00 | paid | tg:123456 | | 09/09/2025 5:31:59 | 09/09/2025 |

### 5. Run Bot

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📖 Struktur Project

```
bot-telegram-pbs/
├── bot-telegram/          # Main bot entry point
│   └── index.js          # Bot initialization & launch
├── src/
│   ├── bot/              # Bot modules (NEW)
│   │   ├── config.js     # Configuration management
│   │   ├── state.js      # State management (sessions, orders, analytics)
│   │   ├── formatters.js # Message formatters
│   │   ├── keyboards.js  # Inline keyboard builders
│   │   └── handlers/     # Request handlers
│   │       ├── commands.js    # Command handlers
│   │       ├── callbacks.js   # Callback query handlers
│   │       ├── purchase.js    # Purchase flow handler
│   │       ├── admin.js       # Admin commands
│   │       └── webhook.js     # Webhook handlers
│   ├── data/             # Data loaders
│   │   ├── products.js   # Product data from sheets
│   │   ├── promos.js     # Promo codes
│   │   └── payments.js   # Payment logs
│   ├── payments/         # Payment integration
│   │   └── midtrans.js   # Midtrans API
│   ├── services/         # External services
│   │   ├── gas.js        # Google Apps Script integration
│   │   └── admin.js      # Admin notifications
│   └── utils/            # Utilities
│       └── index.js      # Helper functions
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

```
POST /webhook/telegram      - Telegram webhook
POST /webhook/midtrans      - Midtrans payment webhook
POST /webhook/refresh       - Refresh produk (from Apps Script)
POST /webhook/lowstock      - Low stock alert (from Apps Script)
GET  /status               - Bot status
GET  /health               - Health check
```

## 🔄 Flow Pembelian

1. **User browse katalog** → Pilih produk dari grid number
2. **Lihat detail** → Info lengkap produk + adjust quantity
3. **Klik Buy** → System reserve stock via Apps Script
4. **Generate QR** → Midtrans QRIS payment
5. **User scan & bayar** → Midtrans webhook notification
6. **Auto finalize** → Apps Script kirim digital item
7. **Delivery** → Bot kirim akun digital ke user

## 💳 Payment Flow

```
User → Bot → Apps Script (Reserve Stock)
           ↓
        Midtrans API (Create QRIS)
           ↓
        User Scan QR & Bayar
           ↓
        Midtrans Webhook → Bot
           ↓
        Apps Script (Finalize & Get Items)
           ↓
        Bot Send Digital Items to User
```

## 🛠️ Google Apps Script Setup

Buat Google Apps Script dengan endpoints:

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  
  if (data.secret !== 'YOUR_SECRET') {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false, error: 'unauthorized'
    }));
  }
  
  switch(data.action) {
    case 'reserve':
      return reserveStock(data.kode, data.qty, data.userRef);
    case 'finalize':
      return finalizeStock(data.order_id, data.total);
    case 'release':
      return releaseStock(data.order_id, data.reason);
  }
}

function reserveStock(kode, qty, userRef) {
  // Check stock availability
  // Create order_id
  // Mark items as reserved
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    order_id: 'PBS-' + Date.now(),
    msg: 'Stock reserved'
  }));
}

function finalizeStock(order_id, total) {
  // Mark items as sold
  // Get digital items data
  // Log to Order_Log sheet
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    items: [{kode: 'NETF1B', data: 'email@test.com||password123'}],
    after_msg: 'Terima kasih!'
  }));
}

function releaseStock(order_id, reason) {
  // Release reserved items back to available
  return ContentService.createTextOutput(JSON.stringify({
    ok: true
  }));
}
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

Bot menyimpan analytics:
- Total orders & revenue
- Product views counter
- Search queries log
- User activity tracking
- Daily statistics

Access via `/admin stats`

## 🔒 Security

- ✅ Signature verification untuk Midtrans webhook
- ✅ Secret key untuk Apps Script authentication
- ✅ Admin-only commands dengan ID whitelist
- ✅ Rate limiting untuk prevent spam
- ✅ Input validation & sanitization

## 🐛 Troubleshooting

### Bot tidak respond
- Check bot token valid
- Verify webhook URL accessible (untuk webhook mode)
- Check firewall/port

### Produk tidak muncul
- Verify SHEET_URL format correct (CSV export URL)
- Check sheet permissions (Anyone with link can view)
- Test URL di browser

### Payment tidak success
- Check Midtrans credentials
- Verify webhook endpoint accessible
- Check webhook signature

### Order stuck
- Check Apps Script logs
- Verify GAS_URL dan GAS_SECRET
- Test Apps Script endpoint manual

## 📝 License

MIT License - Feel free to use and modify

## 👥 Support

- 📧 Email: support@pbsstore.com
- 💬 Telegram: @pbssupport
- 📖 Docs: https://docs.pbsstore.com

## 🙏 Credits

Built with:
- [Telegraf](https://github.com/telegraf/telegraf) - Telegram bot framework
- [Express](https://expressjs.com/) - Web server
- [Midtrans](https://midtrans.com/) - Payment gateway
- [Google Sheets](https://sheets.google.com/) - Database

---

**Made with ❤️ for PBS Digital Store**
