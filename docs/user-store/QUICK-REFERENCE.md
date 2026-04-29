# Quick Reference - PBS User Store

## 🚀 Quick Start

```bash
# 1. Install
cd user && npm install

# 2. Setup .env.local (copy credentials dari bot/dashboard)
cp ../bot-telegram/.env .env.local
# Edit dan sesuaikan dengan format Next.js (tambahkan NEXT_PUBLIC_ prefix)

# 3. Run
npm run dev
```

Buka: http://localhost:3001

## 📝 File Structure Cheat Sheet

```
user/
├── app/
│   ├── page.tsx                    # 🏠 Home/Katalog
│   ├── cart/page.tsx              # 🛒 Keranjang
│   ├── checkout/page.tsx          # 💳 Checkout
│   ├── product/[id]/page.tsx      # 📦 Detail Produk
│   ├── order-success/page.tsx     # ✅ Success
│   ├── order-pending/page.tsx     # ⏳ Pending
│   └── api/
│       ├── checkout/route.ts      # API: Create transaction
│       └── payment-status/route.ts # API: Check status
├── components/
│   ├── CartProvider.tsx           # 🛍️ Cart Context
│   ├── Header.tsx                 # 🎯 Header Navigation
│   └── ProductCard.tsx            # 🎴 Product Card
└── lib/
    ├── supabase.ts                # 📊 Supabase Client
    └── database.types.ts          # 📘 TypeScript Types
```

## 🔑 Environment Variables

```env
# Supabase (dari bot/dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

## 🎨 Main Features

### 1. Katalog Produk (/)
- Display semua produk dari database
- Filter by kategori
- Loading skeleton
- Add to cart langsung dari card

### 2. Detail Produk (/product/[id])
- Gambar produk besar
- Deskripsi lengkap
- Stock indicator
- Quantity selector
- Add to cart atau Beli Sekarang

### 3. Keranjang (/cart)
- List semua items
- Update quantity (+/-)
- Remove item
- Ringkasan harga
- Lanjut ke pembayaran

### 4. Checkout (/checkout)
- Form data pembeli
- Ringkasan pesanan
- Integrasi Midtrans Snap
- QRIS payment only

### 5. Success/Pending Pages
- Konfirmasi status
- Order ID
- Auto redirect
- Check status manual

## 💡 Key Functions

### Cart Management
```typescript
const { items, addToCart, removeFromCart, updateQuantity, total } = useCart()

// Add item
addToCart(product, quantity)

// Update quantity
updateQuantity(productId, newQuantity)

// Remove
removeFromCart(productId)
```

### Fetch Products
```typescript
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('is_active', true)
  .order('name')
```

### Create Transaction
```typescript
const response = await fetch('/api/checkout', {
  method: 'POST',
  body: JSON.stringify({ items, customerName, customerEmail, customerPhone })
})
```

## 🎯 Common Tasks

### Add New Product Field

1. Update type di [lib\database.types.ts](lib\database.types.ts)
2. Update ProductCard di [components\ProductCard.tsx](components\ProductCard.tsx)
3. Update detail page di [app\product\[id]\page.tsx](app\product\[id]\page.tsx)

### Change Payment Method

Edit [app\api\checkout\route.ts](app\api\checkout\route.ts):
```typescript
enabled_payments: ['qris', 'gopay', 'shopeepay']  // Add more
```

### Customize Theme

Edit [tailwind.config.ts](tailwind.config.ts):
```typescript
colors: {
  primary: {
    500: '#yourcolor',
    600: '#yourcolor',
    // ...
  }
}
```

## 🐛 Common Issues & Fixes

### Issue: Products tidak tampil
**Fix**: 
```sql
-- Check RLS policy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public products" ON products FOR SELECT TO anon USING (is_active = true);
```

### Issue: Snap tidak muncul
**Fix**: Check client key di `.env.local` dan browser console

### Issue: Cart tidak persist
**Fix**: Check localStorage di browser (Settings > Storage)

### Issue: Stock tidak update
**Fix**: 
```sql
-- Verify function exists
SELECT * FROM pg_proc WHERE proname = 'decrement_stock';
```

## 📊 Database Queries

### Get Order Details
```sql
SELECT o.*, oi.*, p.name 
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
WHERE o.id = 'order-id';
```

### Check Stock Levels
```sql
SELECT name, stock FROM products WHERE stock < 10 ORDER BY stock;
```

### Sales Summary
```sql
SELECT 
  COUNT(*) as total_orders,
  SUM(total_amount) as total_sales,
  AVG(total_amount) as avg_order
FROM orders 
WHERE status = 'paid';
```

## 🔄 Git Commands

```bash
# Ignore changes to .env.local
git update-index --assume-unchanged .env.local

# Add all changes
git add .

# Commit
git commit -m "feat: add user store"

# Push
git push origin main
```

## 📱 Testing Checklist

- [ ] Home page loads products
- [ ] Category filter works
- [ ] Product detail shows correctly
- [ ] Add to cart updates badge
- [ ] Cart displays items
- [ ] Quantity update works
- [ ] Remove item works
- [ ] Checkout form validates
- [ ] Midtrans Snap opens
- [ ] QRIS payment works (sandbox)
- [ ] Success page shows
- [ ] Stock decrements after payment
- [ ] Order saved in database

## 🚀 Deployment Quick

### Vercel
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

## 📞 Important Links

- **Dev**: http://localhost:3001
- **Supabase**: https://supabase.com/dashboard
- **Midtrans**: https://dashboard.midtrans.com
- **Dashboard**: http://localhost:3000
- **Bot**: Telegram @YourBot

## 🎓 Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Midtrans Docs](https://docs.midtrans.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Tips**: Bookmark this file untuk quick reference! 📌
