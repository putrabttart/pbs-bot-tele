import { Telegraf } from 'telegraf';

// KETIK MANUAL token yang barusan sukses di test-raw (jangan paste dari .env)
const TOKEN = '8385999574:AAGIXV6lRdgU4Vbuu-m5N5jBUUPvyF8CsYw';

console.log('LEN=', TOKEN.length, 'TAIL=', TOKEN.slice(-8));
const bot = new Telegraf(TOKEN);

bot.telegram.getMe()
  .then(me => { console.log('OK getMe Telegraf:', me); process.exit(0); })
  .catch(err => { console.error('ERR getMe Telegraf:', err); process.exit(1); });
