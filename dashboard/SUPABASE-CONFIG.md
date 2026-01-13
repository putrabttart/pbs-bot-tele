# ⚙️ Konfigurasi Supabase untuk Local Development

## 🔧 Add Localhost Redirect URL

1. Buka Supabase Dashboard: https://supabase.com/dashboard
2. Pilih project: `jhrxusliijrgrulrwxjk`
3. Klik **Settings** di sidebar kiri
4. Klik tab **Authentication** 
5. Scroll ke **Redirect URLs** section
6. Klik **Add URL** tombol hijau
7. Masukkan: `http://localhost:3000/`
8. Klik **Add**
9. Klik **Save changes**

## ✅ Setelah setup, Redirect URLs harus berisi:
```
https://independent-bravery-production.up.railway.app/**
http://localhost:3000/
```

## 🧪 Verifikasi User Status

1. Buka Supabase Dashboard
2. **Authentication** → **Users**
3. Cari user `admin@pbs.com`
4. Status harus: **Email confirmed** ✅

Jika belum confirmed:
- Klik user
- Klik tombol **Confirm email**

## ✅ Setelah selesai:
- Refresh page login
- Coba login lagi
- Lihat browser console (F12) untuk error detail
