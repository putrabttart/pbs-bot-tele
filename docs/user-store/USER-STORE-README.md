# 🛍️ PBS User Web Store

Web aplikasi e-commerce untuk customer dengan flow lengkap dari katalog hingga pembayaran QRIS.

## ✨ Fitur Lengkap

- ✅ Katalog produk dengan filter kategori
- ✅ Detail produk dengan gambar
- ✅ Shopping cart (tersimpan di localStorage)
- ✅ Checkout dengan form validasi
- ✅ Pembayaran QRIS via Midtrans Snap
- ✅ Order confirmation & tracking
- ✅ Auto stock decrement setelah payment
- ✅ Responsive design (mobile, tablet, desktop)

## 🚀 Quick Start

```bash
# 1. Masuk ke folder
cd user

# 2. Install & setup (otomatis copy env dari bot/dashboard)
npm run setup

# 3. Edit .env.local - tambahkan Midtrans keys
# Dapatkan keys dari: https://dashboard.midtrans.com (Sandbox)

# 4. Jalankan development server
npm run dev
```

Buka: **http://localhost:3001**

## 📚 Dokumentasi

- **[README.md](README.md)** - Overview & getting started
- **[SETUP-GUIDE.md](SETUP-GUIDE.md)** - Detailed setup & troubleshooting
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Cheat sheet & commands
- **[IMPLEMENTATION-COMPLETE.md](IMPLEMENTATION-COMPLETE.md)** - Full summary

## 🔧 Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** untuk styling
- **Supabase** untuk database (shared dengan bot & dashboard)
- **Midtrans Snap** untuk payment QRIS

## 🎯 User Flow

```
Home (Katalog) 
    → Product Detail 
        → Add to Cart 
            → Shopping Cart 
                → Checkout 
                    → Payment (QRIS) 
                        → Success ✅
```

## 🔐 Environment Variables

Create `.env.local`:

```env
# Supabase (sama dengan bot/dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Midtrans (dari dashboard.midtrans.com)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

## 🗃️ Database Setup

Jalankan migration di Supabase:

```bash
# File: supabase/migrations/006_decrement_stock_function.sql
```

Function ini untuk auto decrement stock saat payment success.

## 🌐 Integration

Web store terintegrasi dengan:
- **Bot Telegram** - Sharing database
- **Dashboard Admin** - Product management
- **Midtrans** - Payment gateway

## 📱 Features Detail

### 1. Katalog Produk
- Grid responsive (1-4 columns)
- Filter by kategori
- Stock indicator (Terbatas/Habis)
- Add to cart dari card

### 2. Detail Produk
- Gambar besar
- Deskripsi lengkap
- Quantity selector
- Breadcrumb navigation

### 3. Shopping Cart
- Update quantity
- Remove items
- Price calculation
- Saved to localStorage

### 4. Checkout & Payment
- Form dengan validasi
- Midtrans Snap integration
- QRIS payment only
- Success/pending pages

## 🎨 Customization

### Ubah Warna
Edit `tailwind.config.ts`:
```typescript
primary: {
  600: '#yourcolor'
}
```

### Ubah Port
Edit `package.json`:
```json
"dev": "next dev -p 3002"
```

### Tambah Payment Method
Edit `app/api/checkout/route.ts`:
```typescript
enabled_payments: ['qris', 'gopay', 'shopeepay']
```

## 🚀 Production Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### Railway
```bash
railway up
```

### PM2
```bash
npm run build
pm2 start npm --name "store" -- start
```

**Jangan lupa:**
- Set `MIDTRANS_IS_PRODUCTION=true`
- Ganti keys ke production
- Update Snap URL ke production

## 🐛 Common Issues

**Produk tidak muncul?**
→ Check Supabase RLS policies

**Snap tidak muncul?**
→ Check Midtrans client key & browser console

**Stock tidak update?**
→ Verify function `decrement_stock` exists

Baca [SETUP-GUIDE.md](SETUP-GUIDE.md) untuk troubleshooting lengkap.

## 📞 Testing

### Test Payment (Sandbox)
1. Checkout → isi form
2. Snap popup muncul
3. Pilih QRIS
4. Gunakan simulator untuk test payment
5. Status akan berubah jadi success

### Test Checklist
- [ ] Products load correctly
- [ ] Category filter works
- [ ] Product detail displays
- [ ] Add to cart works
- [ ] Cart updates correctly
- [ ] Checkout form validates
- [ ] Midtrans Snap opens
- [ ] QRIS payment works
- [ ] Success page shows
- [ ] Stock decrements

## 🎓 Learn More

- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Midtrans: https://docs.midtrans.com
- Tailwind: https://tailwindcss.com/docs

## 📝 Scripts

```bash
npm run dev         # Development server
npm run build       # Production build
npm start           # Production server
npm run copy-env    # Copy env dari bot/dashboard
npm run setup       # Install + copy env
```

## 🎉 Ready to Go!

Web store sudah siap digunakan dan production-ready!

**Selamat berjualan! 🚀**

---

Port default: **3001** (agar tidak konflik dengan dashboard di 3000)
