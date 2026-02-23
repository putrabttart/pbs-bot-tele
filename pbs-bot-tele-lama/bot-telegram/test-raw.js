// bot-telegram/test-raw.js
import https from 'https';

// >>>> KETIK MANUAL token dari @BotFather DI SINI (jangan paste) <<<<
const TOKEN = '8385999574:AAGIXV6lRdgU4Vbuu-m5N5jBUUPvyF8CsYw'; 

// Debug panjang & HEX untuk deteksi karakter nyempil
const buf = Buffer.from(TOKEN, 'utf8');
console.log('LEN =', TOKEN.length, '| TAIL =', TOKEN.slice(-8));
console.log('HEX =', buf.toString('hex'));

const url = `https://api.telegram.org/bot${TOKEN}/getMe`;
console.log('URL =', url);

https.get(url, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('HTTP', res.statusCode);
    console.log('BODY', data);
  });
}).on('error', (e) => {
  console.error('NET ERR', e);
});
