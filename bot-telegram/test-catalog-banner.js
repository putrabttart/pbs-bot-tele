// Test formatProductList dengan format baru (untuk caption photo)
import { formatProductList, getBannerUrl } from './src/bot/formatters.js';

const testProducts = [
  { nama: 'CHATGPT PLUS 1 BULAN PRIVATE', stok: 0 },
  { nama: 'ALIGHT MOTION 1 TAHUN', stok: 2 },
  { nama: 'CANVA PRO HEAD 1 BULAN', stok: 0 },
  { nama: 'CAPCUT PRO 1 BULAN MEMBER', stok: 1 },
  { nama: 'GSUITE YOUTUBE VERIF', stok: 7 },
  { nama: 'YOUTUBE PREMIUM 1 BULAN AKUN SELLER', stok: 2 },
  { nama: 'VIDIO PLATINUM 1 TAHUN TV ONLY', stok: 3 },
  { nama: 'VIU PREMIUM 1 TAHUN', stok: 6 },
];

console.log('=== FORMAT KATALOG (Untuk Caption Photo) ===\n');
const output = formatProductList(testProducts, 1, 10, 8);
console.log(output);

console.log('\n\n=== PAGE 2 (PAGINATION) ===\n');
const page2 = formatProductList(testProducts.slice(4), 2, 4, 8);
console.log(page2);

console.log('\n\nℹ️ Banner URL (jika ada):');
console.log(getBannerUrl() ? '✅ ' + getBannerUrl() : '❌ Tidak ada banner');
console.log('\n✅ Format akan muncul sebagai caption di bawah photo!');


