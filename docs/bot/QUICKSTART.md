# ⚡ Quick Start Guide - PBS Telegram Bot

## 🚀 5 Menit Setup!

### Step 1: Clone & Install (1 menit)

```bash
cd d:\Bot\bot-telegram-pbs
npm install
```

### Step 2: Configure Environment (2 menit)

```bash
# Sudah ada .env? Skip ke step 3!
# Belum ada? Copy dari template:
copy .env.example .env
```

Edit `.env` - Isi yang wajib:

```env
# Dari @BotFather di Telegram
TELEGRAM_BOT_TOKEN=8385999574:AAEdIm9zrAg4Itl121Gy20CCblnOQD0C5T0

# ID Telegram Anda (dari @userinfobot)
TELEGRAM_ADMIN_IDS=1099822426

# URL Export CSV dari Google Sheets
SHEET_URL=https://docs.google.com/spreadsheets/d/1QKZb5BXVqrNyxrA6mhL1sJI2hHZ2MMS1KqI6pzf/export?format=csv&gid=626301941

# Apps Script Webhook URL
GAS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
GAS_SECRET=JANGAN_LUPA_MAKAN

# Midtrans Credentials
MIDTRANS_SERVER_KEY=SB-Mid-server-YOUR_KEY
MIDTRANS_IS_PRODUCTION=false

# Server Config
HTTP_PORT=3000
PUBLIC_BASE_URL=https://bot-pbs.putrabttstorebot.my.id
```

### Step 3: Start Bot! (1 menit)

```bash
npm start
```

Anda akan melihat:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 PBS Telegram Bot v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Configuration validated
✅ Connected as @YourBotUsername (ID: 123456789)
📦 Store: PBS Digital Store
👥 Admins: 1099822426
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting bot...
📦 Loading products...
✅ Loaded 60 products
🌐 Setting up webhook mode...
✅ Webhook set to: https://your-domain.com/webhook/telegram
✅ Server listening on port 3000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Bot is running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4: Test Bot! (1 menit)

Buka Telegram, cari bot Anda, dan kirim:

```
/start
```

Anda akan mendapat welcome message dan main menu!

---

## 🎮 Quick Commands to Try:

```
/menu          # Lihat katalog produk
/search netflix # Cari produk Netflix
/buy netf1b 1  # Beli Netflix 1 bulan
/favorites     # Lihat favorit
/history       # Lihat riwayat
/admin         # Dashboard admin (khusus admin)
```

## 🔥 Quick Actions:

Ketik langsung di chat (tanpa slash):

```
netflix         # Cari produk Netflix
cc1b 1         # Beli produk CC1B qty 1
netf1b         # Lihat detail produk NETF1B
```

---

## ✅ Checklist Setup:

- [x] Bot token dari @BotFather
- [x] Admin ID dari @userinfobot  
- [x] Google Sheets URL (CSV export)
- [x] Apps Script deployed & URL
- [x] Midtrans server key
- [x] Public URL untuk webhook
- [x] npm install done
- [x] .env configured
- [x] npm start success
- [x] /start tested in Telegram

---

## 🔧 Troubleshooting:

### Bot tidak start?
```bash
# Check token format
# Harus: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Check .env file exist
dir .env

# Check syntax error
npm start
```

### Produk tidak muncul?
```bash
# Test SHEET_URL di browser
# Harus return CSV format

# Check logs
# Look for: [PRODUCTS] Loaded X products
```

### Payment tidak jalan?
```bash
# Check Midtrans credentials
# Test di Midtrans dashboard

# Check webhook URL accessible
curl https://your-domain.com/status
```

---

## 📚 Need Help?

1. **README.md** - Complete documentation
2. **DEVELOPER_GUIDE.md** - Technical guide
3. **CHANGELOG.md** - What's new
4. **SUMMARY.md** - Feature overview

---

## 🎯 What's Next?

### Untuk User Testing:
1. Browse katalog dengan /menu
2. Coba search produk
3. Lihat detail produk
4. Adjust quantity
5. Test buy flow (gunakan Midtrans sandbox)
6. Check riwayat pembelian
7. Test favorit

### Untuk Admin:
1. Akses /admin dashboard
2. Check statistik
3. Monitor active orders
4. Test broadcast
5. Check system health

---

## 🚀 Production Deployment:

### Jika sudah siap production:

1. **Update .env:**
```env
MIDTRANS_IS_PRODUCTION=true
PUBLIC_BASE_URL=https://your-production-domain.com
```

2. **Set Midtrans Webhook:**
- Login ke Midtrans dashboard
- Settings → Configuration
- Payment Notification URL: `https://your-domain.com/webhook/midtrans`

3. **Deploy:**
```bash
# Gunakan PM2
npm install -g pm2
pm2 start bot-telegram/index.js --name pbs-bot
pm2 save
pm2 startup
```

4. **Monitor:**
```bash
pm2 monit
pm2 logs pbs-bot
```

---

## 🎉 Done!

Bot Telegram Anda siap digunakan!

Selamat berjualan! 🛍️💰

---

**Quick Links:**
- [Full Documentation](README.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Feature List](SUMMARY.md)
- [Changelog](CHANGELOG.md)
