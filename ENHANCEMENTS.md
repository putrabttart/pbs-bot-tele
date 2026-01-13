# Enhancement Features - PBS Telegram Bot v2.0

## 🚀 Fitur Baru yang Ditambahkan

### 1. Rate Limiting & Anti-Spam
**File:** `src/utils/rateLimiter.js`

Token bucket rate limiter untuk mencegah spam dan brute force:
- **Message Limiter**: 20 request, refill 2 token/detik
- **Command Limiter**: 10 command, refill 1 token/2 detik  
- **Callback Limiter**: 30 callback, refill 3 token/detik
- Admin otomatis di-bypass dari rate limiting
- Auto cleanup bucket yang tidak aktif > 1 jam

**Middleware:**
```javascript
import { messageLimiter, createRateLimitMiddleware } from './src/utils/rateLimiter.js';

bot.use(createRateLimitMiddleware(messageLimiter, {
  skipCondition: (ctx) => isAdmin(ctx.from?.id)
}));
```

### 2. Structured Logger dengan Correlation ID
**File:** `src/utils/logger.js`

Logger dengan format JSON, level, dan correlation tracking:
- Level: DEBUG, INFO, WARN, ERROR, FATAL
- Format: JSON atau Pretty (untuk development)
- Correlation ID otomatis untuk tracking request
- File logging (opsional)
- Middleware untuk Express dan Telegraf

**Usage:**
```javascript
import { logger } from './src/utils/logger.js';

logger.info('User started bot', { userId: 123, username: 'john' });
logger.error('Payment failed', { orderId: 'ORD123', error: err.message });
```

**Environment Variables:**
- `LOG_LEVEL`: DEBUG | INFO | WARN | ERROR | FATAL (default: INFO)
- `LOG_FORMAT`: json | pretty (default: pretty)
- `LOG_TO_FILE`: true | false (default: false)

### 3. Prometheus Metrics
**File:** `src/utils/metrics.js`

Metrics collector untuk monitoring dan observability:
- **Counters**: command hits, errors, payments
- **Gauges**: active users, memory usage
- **Histograms**: latency, response time
- Export ke Prometheus format atau JSON

**Endpoints:**
- `GET /metrics` - Prometheus text format
- `GET /metrics/json` - JSON format

**Metrics Available:**
- `bot_commands_received_total{command}`
- `bot_command_duration_ms{command}`
- `bot_command_errors_total{command,error}`
- `bot_callbacks_received_total{action}`
- `bot_payments_created_total`
- `bot_payments_success_total`
- `http_requests_total{method,route}`
- `http_request_duration_ms{method,route,status}`

### 4. Scheduled Jobs & Automation
**File:** `src/services/scheduler.js`

Cron-like scheduler untuk tugas periodik:

**Jobs yang tersedia:**
- **product-refresh**: Auto refresh produk dari Google Sheets (setiap 30 menit)
- **low-stock-alert**: Cek stok rendah dan kirim alert ke admin (setiap 1 jam)
- **cleanup-old-data**: Hapus data lama seperti search results (setiap 24 jam)
- **metrics-update**: Update metrics gauge (setiap 60 detik)

**Admin dapat melihat status jobs:** `/admin health`

### 5. Settings Management
**File:** `src/services/settings.js`

Sistem pengaturan bot yang persisten:

**Kategori Settings:**
- **Store**: name, description, currency, timezone
- **Payment**: methods, autoConfirm, expiryMinutes
- **Notifications**: thresholds, alerts
- **Messages**: custom welcome, order confirmed, etc.
- **Features**: enable/disable fitur
- **Limits**: max search results, history, favorites
- **Maintenance**: mode dan message

**Admin Commands:**
```bash
/admin settings show                    # Lihat semua settings
/admin settings set store.name PBS Shop # Set nilai
/admin settings get payment.methods     # Get nilai
/admin settings reset                   # Reset ke default
/admin settings export                  # Export ke file JSON
```

**Settings File:** `data/settings.json`

### 6. Backup & Restore
**File:** `src/services/backup.js`

Sistem backup otomatis dengan kompresi:

**Fitur:**
- Backup products, payments, settings, state
- Kompresi Gzip untuk menghemat space
- List, delete, dan cleanup backup lama
- Restore dari backup dengan seleksi data

**Admin Commands:**
```bash
/admin backup create              # Buat backup baru
/admin backup list                # Lihat semua backup
/admin backup delete <filename>   # Hapus backup
/admin backup cleanup             # Hapus backup lama (keep 10 terbaru)
/admin restore <filename>         # Restore dari backup
```

**Backup Directory:** `backups/`

**Format File:** `backup-YYYY-MM-DDTHH-mm-ss.json.gz`

### 7. Midtrans Signature Verification
**File:** `src/payments/midtrans.js`

Verifikasi signature webhook untuk keamanan:
- SHA512 hash verification
- Mencegah fake webhook requests
- Auto reject invalid signatures

**Fungsi sudah ada, tinggal digunakan:**
```javascript
import { verifyMidtransSignature } from './src/payments/midtrans.js';

const isValid = verifyMidtransSignature({
  order_id: 'ORD123',
  status_code: '200',
  gross_amount: '50000',
  signature_key: req.headers['x-signature']
});
```

### 8. Enhanced Status Endpoint
**Endpoint:** `GET /status`

Status endpoint yang lebih lengkap untuk monitoring:

**Response:**
```json
{
  "status": "online",
  "uptime": 3600,
  "version": "2.0.0",
  "commit": "abc123",
  "timestamp": "2025-12-29T...",
  "bot": {
    "connected": true,
    "admins": 2
  },
  "data": {
    "products": 150,
    "activeOrders": 5,
    "lastProductLoad": "2025-12-29T..."
  },
  "scheduler": {
    "running": true,
    "jobs": [...]
  },
  "settings": {
    "maintenance": false
  },
  "metrics": {
    "counters": 45,
    "gauges": 12,
    "histograms": 8
  },
  "memory": {
    "used": 128,
    "total": 256
  }
}
```

### 9. Graceful Shutdown
**File:** `bot-telegram/index.js`

Shutdown yang benar dengan cleanup:
1. Stop HTTP server (tidak terima koneksi baru)
2. Stop scheduler (hentikan semua jobs)
3. Stop bot (tunggu request selesai)
4. Exit dengan bersih

**Signals:** SIGINT (Ctrl+C), SIGTERM (Docker/PM2)

## 📊 Monitoring & Observability

### Prometheus Integration
Tambahkan ke `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'pbs-bot'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana Dashboard
Import metrics untuk visualisasi:
- Request rate per command
- Error rate
- Response latency (P50, P95, P99)
- Active users
- Payment success rate

## 🔒 Security Improvements

1. **Rate Limiting**: Cegah spam dan DDoS
2. **Signature Verification**: Validasi webhook authenticity
3. **Admin-only Commands**: Settings dan backup hanya untuk admin
4. **Correlation ID**: Tracking untuk audit log
5. **Error Handling**: Detailed logging tanpa expose ke user

## 🎯 Best Practices Applied

1. **Separation of Concerns**: Setiap fitur di file terpisah
2. **Configuration**: Centralized di settings.js
3. **Error Handling**: Consistent error logging
4. **Graceful Degradation**: Fitur tetap jalan walau ada error
5. **Resource Cleanup**: Proper shutdown dan cleanup
6. **Observability**: Logging, metrics, dan health checks

## 🚀 Getting Started

### Environment Variables
Tambahkan ke `.env`:
```bash
# Logging
LOG_LEVEL=INFO
LOG_FORMAT=pretty
LOG_TO_FILE=false

# Metrics
ENABLE_METRICS=true

# Scheduler
PRODUCT_REFRESH_INTERVAL=30  # minutes
LOW_STOCK_ALERT_INTERVAL=60  # minutes
LOW_STOCK_THRESHOLD=5

# Backup
AUTO_BACKUP=false
AUTO_BACKUP_INTERVAL=24  # hours
BACKUP_RETENTION=10  # keep last N backups
```

### Admin Commands Summary
```bash
# Dashboard & Stats
/admin                          # Show dashboard
/admin stats                    # Detailed statistics
/admin topproducts              # Top viewed products
/admin users                    # User activity
/admin orders                   # Active orders
/admin health                   # System health + scheduler status

# Data Management
/admin refresh                  # Force refresh products
/admin broadcast <message>      # Send to all users

# Settings
/admin settings show            # Show all settings
/admin settings set <path> <val># Update setting
/admin settings get <path>      # Get setting value
/admin settings reset           # Reset to defaults
/admin settings export          # Export settings

# Backup & Restore
/admin backup create            # Create backup
/admin backup list              # List backups
/admin backup delete <file>     # Delete backup
/admin backup cleanup           # Cleanup old backups
/admin restore <file>           # Restore from backup
```

## 📈 Next Steps (Future Enhancements)

1. **Redis Integration**: Distributed rate limiting & caching
2. **Database**: PostgreSQL untuk data persisten
3. **Queue System**: Bull/BullMQ untuk background jobs
4. **Sentry Integration**: Error tracking & alerting
5. **Admin Web Panel**: Web interface untuk management
6. **Multi-language**: i18n support
7. **A/B Testing**: Feature flags
8. **Analytics**: Advanced user behavior tracking

## 🐛 Troubleshooting

### Rate Limit Issues
Jika user terlalu banyak di-rate limit:
```javascript
// Adjust di src/utils/rateLimiter.js
export const messageLimiter = new RateLimiter({
  maxTokens: 30,      // Increase from 20
  refillRate: 3,      // Increase from 2
});
```

### Scheduler Not Running
Check logs untuk error. Pastikan jobs di-setup di `launch()`:
```javascript
await setupProductRefreshJob(30);
await setupLowStockAlertJob(bot, {...});
```

### Backup Failed
Pastikan directory `backups/` ada dan writable:
```bash
mkdir -p backups
chmod 755 backups
```

### Metrics Not Updating
Check endpoint `/metrics/json` untuk debug. Pastikan middleware terpasang:
```javascript
app.use(createHttpMetricsMiddleware());
```

## 📚 Documentation Links

- [Telegraf Docs](https://telegraf.js.org)
- [Prometheus Docs](https://prometheus.io/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Version:** 2.0.0  
**Last Updated:** December 29, 2025  
**Author:** PBS Bot Team
