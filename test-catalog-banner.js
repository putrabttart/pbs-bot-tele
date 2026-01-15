// Test formatProductList dengan format baru
import { formatProductList, getBannerUrl } from './src/bot/formatters.js';

const testProducts = [
  { nama: 'ZOOM ONE PRO', stok: 20 },
  { nama: 'CAPCUT', stok: 20 },
  { nama: 'GSUITE X PAYMENT', stok: 20 },
  { nama: 'EXPRESS VPN', stok: 20 },
  { nama: 'SPOTIFY', stok: 20 },
  { nama: 'CHATGPT HEAD', stok: 20 },
  { nama: 'YOUTUBE PREMIUM', stok: 20 },
  { nama: 'GSUITE YOUTUBE', stok: 20 },
  { nama: 'GMAIL FRESH', stok: 20 },
];

console.log('=== FORMAT KATALOG BARU ===\n');
const output = formatProductList(testProducts, 1, 10, 9);
console.log(output);

console.log('\n\n=== DENGAN STOK BERVARIASI ===\n');
const variedProducts = [
  { nama: 'ZOOM ONE PRO', stok: 5 },
  { nama: 'CAPCUT', stok: 0 },
  { nama: 'GSUITE X PAYMENT', stok: 999 },
  { nama: 'EXPRESS VPN', stok: 15 },
  { nama: 'SPOTIFY PREMIUM', stok: 25 },
];

const outputVaried = formatProductList(variedProducts, 1, 5, 5);
console.log(outputVaried);

console.log('\n\n=== PAGE 2 (PAGINATION) ===\n');
const page2 = formatProductList(testProducts.slice(5), 2, 5, 9);
console.log(page2);

console.log('\n\nℹ️ Banner URL (jika ada):');
console.log(getBannerUrl() ? '✅ ' + getBannerUrl() : '❌ Tidak ada banner');

