# Setup Banner Katalog Produk

## Cara Mengubah Banner Gambar

Banner gambar katalog produk dapat diatur melalui **environment variable** atau di file `.env`

### 1. Tambahkan di `.env` file:

```env
# Banner gambar untuk halaman katalog produk (PNG/JPG)
CATALOG_BANNER_URL=https://example.com/banner.jpg
```

### 2. Contoh Banner URL yang Bisa Digunakan:

- **Local Image**: Upload ke hosting (Imgur, Cloudinary, GitHub, dll)
- **Direct Link**: 
  - `https://i.imgur.com/xxx.jpg`
  - `https://res.cloudinary.com/xxx/image/upload/xxx.jpg`
  - `https://cdn.example.com/banner.png`

---

## Contoh Output

### Dengan Banner:
```
🖼️ [BANNER](https://i.imgur.com/banner.jpg)

╭──────〔 LIST PRODUCT 〕─ 
┊ [ 1 ] ZOOM ONE PRO [ 20 ]
┊ [ 2 ] CAPCUT [ 20 ]
┊ [ 3 ] GSUITE X PAYMENT [ 20 ]
┊ [ 4 ] EXPRESS VPN [ 20 ]
┊ [ 5 ] SPOTIFY [ 20 ]
┊ [ 6 ] CHATGPT HEAD [ 20 ]
┊ [ 7 ] YOUTUBE PREMIUM [ 20 ]
┊ [ 8 ] GSUITE YOUTUBE [ 20 ]
┊ [ 9 ] GMAIL FRESH [ 20 ]
╰─────────────────╯
```

### Tanpa Banner (Default):
```
PBS Digital Store

╭──────〔 LIST PRODUCT 〕─ 
┊ [ 1 ] ZOOM ONE PRO [ 20 ]
┊ [ 2 ] CAPCUT [ 20 ]
┊ [ 3 ] GSUITE X PAYMENT [ 20 ]
┊ [ 4 ] EXPRESS VPN [ 20 ]
┊ [ 5 ] SPOTIFY [ 20 ]
┊ [ 6 ] CHATGPT HEAD [ 20 ]
┊ [ 7 ] YOUTUBE PREMIUM [ 20 ]
┊ [ 8 ] GSUITE YOUTUBE [ 20 ]
┊ [ 9 ] GMAIL FRESH [ 20 ]
╰─────────────────╯
```

---

## File yang Berubah

1. **[src/bot/config.js](../src/bot/config.js)** - Tambahan config `CATALOG_BANNER_URL`
2. **[src/bot/formatters.js](../src/bot/formatters.js)** - Update `formatProductList()` function
3. **[src/bot/handlers/commands.js](../src/bot/handlers/commands.js)** - Pass banner URL ke formatter

---

## Langkah Implementasi

### Step 1: Siapkan Gambar Banner
- Dimensi: 400x200px atau 600x300px (recommended)
- Format: PNG, JPG, WebP
- Upload ke hosting gratis (Imgur, Cloudinary, atau GitHub Raw)

### Step 2: Copy URL Gambar
Contoh dari Imgur:
```
https://i.imgur.com/abc123.jpg
```

### Step 3: Set di `.env`
```env
CATALOG_BANNER_URL=https://i.imgur.com/abc123.jpg
```

### Step 4: Restart Bot
```bash
npm restart
# atau
node index.js
```

---

## Hosting Gratis untuk Banner

### Imgur (Recommended)
1. Buka https://imgur.com/upload
2. Upload gambar
3. Klik kanan → "Copy image link"
4. Use link sebagai `CATALOG_BANNER_URL`

### GitHub (Alternative)
1. Upload ke GitHub repo
2. Click file → "Raw"
3. Copy raw URL
```
https://raw.githubusercontent.com/username/repo/main/banner.jpg
```

### CloudFront / Cloudinary
1. Daftar gratis
2. Upload gambar
3. Copy public link

---

## Testing Output

Ketika user ketik `/menu`, output akan menampilkan:

**Jika punya banner:**
```
🖼️ [BANNER](URL)

[LIST PRODUK]
```

**Jika tanpa banner (kosong di `.env`):**
```
PBS Digital Store

[LIST PRODUK]
```

---

## Format Katalog yang Baru

Format setiap produk:
```
[ NOMOR ] NAMA_PRODUK [ STOK ]
```

**Perubahan dari format lama:**
- ❌ Hapus harga langsung dari list
- ✅ Tampilin cuma: nomor, nama, stok
- ✅ Format lebih rapi dan minimalist

---

## Contoh Real

User ketik: `/menu`

Output:
```
🖼️ [BANNER](https://i.imgur.com/abc.jpg)

╭──────〔 LIST PRODUCT 〕─ 
┊ [ 1 ] ZOOM ONE PRO [ 20 ]
┊ [ 2 ] CAPCUT [ 15 ]
┊ [ 3 ] GSUITE X PAYMENT [ 5 ]
┊ [ 4 ] EXPRESS VPN [ 0 ]
┊ [ 5 ] SPOTIFY [ 999 ]
┊ [ 6 ] CHATGPT HEAD [ 50 ]
┊ [ 7 ] YOUTUBE PREMIUM [ 20 ]
┊ [ 8 ] GSUITE YOUTUBE [ 20 ]
┊ [ 9 ] GMAIL FRESH [ 30 ]
╰─────────────────╯
```

User klik nomor produk → lihat detail + harga

---

## Notes

- Banner tampil sebagai link Telegram (bukan embedded image)
- Untuk lihat detail harga, user harus klik nomor produk
- Bisa change banner kapan saja tanpa restart (cukup update `.env`)
- Jika URL invalid/broken, akan tampil text biasa tanpa banner

