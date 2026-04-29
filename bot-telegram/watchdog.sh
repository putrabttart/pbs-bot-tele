#!/data/data/com.termux/files/usr/bin/bash
# watchdog.sh — cek setiap 60 dtk; jika bot/tunnel mati, nyalakan lagi

APP_ROOT="$HOME/bot-telegram-pbs"
BOT_ENTRY="bot-telegram/index.telegram.js"
TUNNEL_NAME="bot-pbs"
LOGDIR="$APP_ROOT/logs"

mkdir -p "$LOGDIR"

while true; do
  # BOT
  if ! pgrep -fa "node $BOT_ENTRY" >/dev/null 2>&1; then
    echo "[WATCHDOG] Bot mati — restart..."
    cd "$APP_ROOT" || exit 1
    nohup node "$BOT_ENTRY" >> "$LOGDIR/bot.out" 2>> "$LOGDIR/bot.err" &
    sleep 2
  fi

  # TUNNEL
  if ! pgrep -fa "cloudflared tunnel run $TUNNEL_NAME" >/dev/null 2>&1; then
    echo "[WATCHDOG] Tunnel mati — restart..."
    nohup cloudflared tunnel run "$TUNNEL_NAME" >> "$LOGDIR/cloudflared.out" 2>> "$LOGDIR/cloudflared.err" &
    sleep 2
  fi

  sleep 60
done
