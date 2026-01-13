import { Telegraf } from 'telegraf';

// PASTE token persis dari @BotFather (yang barusan kamu tes di browser)
const TOKEN = '1234567890:ABCDEF...'; 

const bot = new Telegraf(TOKEN);
bot.telegram.getMe()
  .then(me => { console.log('OK getMe:', me); process.exit(0); })
  .catch(err => { console.error('ERR getMe:', err); process.exit(1); });
