# Setup Guide - PBS User Store

Panduan lengkap untuk setup dan menjalankan web store untuk user.

## 📋 Prerequisites

- Node.js 18+ installed
- NPM atau Yarn
- Akses ke Supabase database (sama dengan bot/dashboard)
- Akun Midtrans (Sandbox untuk testing)

## 🔧 Step-by-Step Setup

### 1. Install Dependencies

```bash
cd user
npm install
```

### 2. Setup Environment Variables

Buat file `.env.local` di folder `user/`:

```env
# Supabase Configuration (copy dari bot atau dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Midtrans Configuration
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false
```

**Cara mendapatkan Midtrans Keys:**

1. Daftar di [Midtrans](https://midtrans.com/)
2. Login ke Dashboard Midtrans
3. Pilih Environment: **Sandbox** (untuk testing)
4. Pergi ke Settings > Access Keys
5. Copy **Server Key** dan **Client Key**

### 3. Setup Database

Jalankan migration untuk function `decrement_stock`:

1. Buka Supabase Dashboard
2. Pergi ke SQL Editor
3. Run file: `supabase/migrations/006_decrement_stock_function.sql`

Atau langsung run SQL:

```sql
CREATE OR REPLACE FUNCTION decrement_stock(product_id UUID, quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(stock - quantity, 0),
      updated_at = NOW()
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decrement_stock TO anon, authenticated;
```

### 4. Pastikan Ada Data Produk

Web ini membutuhkan data produk di database. Jika belum ada:

**Option A: Via Dashboard**
1. Buka dashboard admin
2. Pergi ke halaman Products
3. Tambahkan produk baru

**Option B: Via SQL**
```sql
INSERT INTO products (name, description, price, stock, category, is_active)
VALUES 
  ('Produk Demo 1', 'Deskripsi produk demo', 50000, 10, 'Elektronik', true),
  ('Produk Demo 2', 'Deskripsi produk demo', 75000, 5, 'Fashion', true);
```

### 5. Run Development Server

```bash
npm run dev
```

Web akan berjalan di: `http://localhost:3001`

## 🧪 Testing

### Test Flow Lengkap:

1. **Buka katalog**: http://localhost:3001
   - ✓ Produk tampil dengan gambar
   - ✓ Category filter berfungsi
   - ✓ Loading skeleton muncul saat fetch

2. **Klik produk**:
   - ✓ Detail produk tampil
   - ✓ Quantity selector berfungsi
   - ✓ Add to cart menambah item

3. **Buka cart**: Klik icon cart di header
   - ✓ Items tampil dengan benar
   - ✓ Update quantity berfungsi
   - ✓ Remove item berfungsi
   - ✓ Total harga benar

4. **Checkout**:
   - ✓ Form validation berfungsi
   - ✓ Isi nama, email, phone
   - ✓ Klik "Bayar Sekarang"

5. **Pembayaran**:
   - ✓ Midtrans Snap popup muncul
   - ✓ QR Code QRIS tampil
   - ✓ Bisa scan atau pilih metode test

6. **Test Payment** (Sandbox):
   - Gunakan QRIS simulator di Midtrans
   - Atau klik "Pay" di simulator
   - Status akan berubah jadi "Success"

7. **Verify**:
   - ✓ Redirect ke halaman success
   - ✓ Cart kosong
   - ✓ Stock produk berkurang (cek database)
   - ✓ Order tersimpan di table orders

### Test Payment di Sandbox:

Midtrans Sandbox menyediakan cara untuk test tanpa bayar real:

1. Saat popup Snap muncul
2. Pilih QRIS
3. Gunakan test credentials atau simulator
4. Payment akan langsung success

**Test Cards untuk Sandbox:**
- Success: Gunakan any valid format
- Pending: Akan expire setelah beberapa saat
- Deny: Gunakan specific test cards

## 🚨 Troubleshooting

### Midtrans Snap tidak muncul

**Problem**: Popup Midtrans tidak muncul setelah klik "Bayar Sekarang"

**Solutions**:
1. Check browser console untuk errors
2. Verify `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` di `.env.local`
3. Clear browser cache dan reload
4. Pastikan Snap script loaded (check Network tab)
5. Test di browser lain (Chrome/Firefox)

### Products tidak tampil

**Problem**: Halaman katalog kosong

**Solutions**:
1. Check Supabase connection:
   ```bash
   # Test di browser console
   const { data } = await supabase.from('products').select('*')
   console.log(data)
   ```
2. Verify products table memiliki data
3. Check RLS policies (products harus bisa diakses anon)
4. Check browser console untuk errors

### Payment tidak update status

**Problem**: Setelah bayar, status order tidak berubah

**Solutions**:
1. Check function `decrement_stock` sudah dibuat
2. Verify Midtrans webhook settings (untuk production)
3. Check logs di Midtrans Dashboard
4. Manually check payment status dengan tombol "Cek Status"

### Cart tidak tersimpan

**Problem**: Item hilang setelah refresh

**Solutions**:
1. Check localStorage enabled di browser
2. Clear localStorage dan test lagi:
   ```javascript
   localStorage.clear()
   ```
3. Test di incognito/private mode

### Build errors

**Problem**: Error saat `npm run build`

**Solutions**:
1. Delete `.next` folder:
   ```bash
   rm -rf .next
   ```
2. Clear node_modules dan reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Check TypeScript errors:
   ```bash
   npm run build -- --debug
   ```

## 🔐 Security Notes

### Environment Variables

**NEVER** commit `.env.local` ke git!

File sudah included di `.gitignore`, tapi pastikan:
```bash
# Check if .env.local is ignored
git status
```

### Supabase RLS

Pastikan Row Level Security (RLS) aktif:

```sql
-- Products harus bisa dibaca public
CREATE POLICY "Products are viewable by everyone"
ON products FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Orders hanya bisa dibuat
CREATE POLICY "Anyone can create orders"
ON orders FOR INSERT
TO anon, authenticated
WITH CHECK (true);
```

### Midtrans Keys

- **Server Key**: HARUS disimpan di server (tidak boleh di client)
- **Client Key**: Boleh di client (untuk Snap)
- Gunakan Sandbox untuk development
- Switch ke Production keys saat deploy

## 📦 Production Deployment

### Option 1: Vercel (Recommended)

1. Push code ke GitHub
2. Import project di Vercel
3. Add environment variables di Vercel Dashboard
4. Deploy!

Environment variables untuk production:
```env
NEXT_PUBLIC_SUPABASE_URL=your_prod_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_prod_key
MIDTRANS_SERVER_KEY=your_prod_server_key
MIDTRANS_CLIENT_KEY=your_prod_client_key
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_prod_client_key
MIDTRANS_IS_PRODUCTION=true
```

**Important**: Ganti Snap URL di [checkout\page.tsx](checkout\page.tsx):
```typescript
// Change from sandbox to production
<Script
  src="https://app.midtrans.com/snap/snap.js"  // Remove 'sandbox.'
  data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
  onLoad={() => setSnapLoaded(true)}
  strategy="afterInteractive"
/>
```

### Option 2: Railway

1. Install Railway CLI
2. Run: `railway login`
3. Run: `railway init`
4. Add environment variables
5. Run: `railway up`

### Option 3: Self-Hosted

1. Build:
   ```bash
   npm run build
   ```

2. Start with PM2:
   ```bash
   pm2 start npm --name "pbs-store" -- start
   ```

3. Setup Nginx reverse proxy:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 🔄 Updates & Maintenance

### Update Dependencies

```bash
npm update
```

### Backup Database

Supabase auto-backup, tapi bisa manual export:
```bash
# Via Supabase CLI
supabase db dump -f backup.sql
```

### Monitor Errors

Check logs di:
- Browser Console (client errors)
- Terminal (server errors)
- Vercel/Railway logs (production)
- Supabase logs (database)

## 📞 Support

Jika ada masalah:
1. Check README.md
2. Check troubleshooting section ini
3. Check browser console
4. Check Supabase logs
5. Check Midtrans dashboard

## ✅ Checklist Sebelum Production

- [ ] All environment variables set di production
- [ ] Midtrans keys diganti ke production
- [ ] Snap URL diganti ke production
- [ ] RLS policies sudah benar
- [ ] Test full flow di staging
- [ ] Domain sudah setup
- [ ] SSL certificate active
- [ ] Error monitoring setup
- [ ] Backup strategy ready
- [ ] Payment webhook configured di Midtrans

---

**Happy Selling! 🎉**
