# 🎓 Developer Guide - PBS Telegram Bot

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Code Structure](#code-structure)
3. [Key Concepts](#key-concepts)
4. [Adding Features](#adding-features)
5. [Best Practices](#best-practices)
6. [Testing](#testing)
7. [Deployment](#deployment)

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Telegram  │◄────►│     Bot     │◄────►│   Google    │
│    Users    │      │   Server    │      │   Sheets    │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   Midtrans  │
                     │   Payment   │
                     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   Google    │
                     │ Apps Script │
                     └─────────────┘
```

### Data Flow

1. **Product Browsing**
   - User → Bot → State Management → Product Data → Format → User

2. **Purchase Flow**
   - User → Buy Request → Reserve Stock (GAS) → Create Payment (Midtrans) → QR Code → User
   - User Pays → Midtrans Webhook → Bot → Finalize Stock (GAS) → Get Items → Deliver to User

3. **Admin Operations**
   - Admin → Command → Verify Permission → Execute → Analytics → Response

---

## 📁 Code Structure

### Directory Layout

```
bot-telegram-pbs/
├── bot-telegram/
│   └── index.js                 # Main entry point
├── src/
│   ├── bot/                     # Bot modules
│   │   ├── config.js           # Configuration management
│   │   ├── state.js            # State and session management
│   │   ├── formatters.js       # Message formatters
│   │   ├── keyboards.js        # Inline keyboard builders
│   │   └── handlers/           # Request handlers
│   │       ├── commands.js     # Command handlers
│   │       ├── callbacks.js    # Callback query handlers
│   │       ├── purchase.js     # Purchase flow
│   │       ├── admin.js        # Admin commands
│   │       └── webhook.js      # Webhook handlers
│   ├── data/                   # Data management
│   │   ├── products.js        # Product data loader
│   │   ├── promos.js          # Promo codes (future)
│   │   └── payments.js        # Payment logs (future)
│   ├── payments/              # Payment integration
│   │   └── midtrans.js       # Midtrans API
│   ├── services/             # External services
│   │   └── gas.js           # Apps Script integration
│   └── utils/               # Utilities
│       └── index.js        # Helper functions
├── .env.example           # Environment template
├── package.json          # Dependencies
└── README.md            # Documentation
```

### Module Responsibilities

#### `bot/config.js`
- Load and validate environment variables
- Provide typed configuration object
- Handle defaults and type conversion

#### `bot/state.js`
- Manage user sessions
- Track active orders
- Store analytics data
- Handle favorites and history
- Session cleanup

#### `bot/formatters.js`
- Format messages for display
- Currency formatting
- Date/time formatting
- List and detail formatters
- Receipt generation

#### `bot/keyboards.js`
- Build inline keyboards
- Product grid navigation
- Detail action buttons
- Admin keyboards
- Category selection

#### `bot/handlers/commands.js`
- Handle slash commands
- Process text messages
- Route to appropriate handlers
- Rate limiting

#### `bot/handlers/callbacks.js`
- Handle callback queries
- Route to specific actions
- Update message content
- Manage keyboard states

#### `bot/handlers/purchase.js`
- Coordinate purchase flow
- Reserve stock
- Create payment
- Generate QR code
- Poll payment status
- Handle success/failure
- Deliver digital items

#### `bot/handlers/admin.js`
- Admin authentication
- Dashboard display
- Statistics generation
- User management
- Broadcast messaging
- System health

#### `bot/handlers/webhook.js`
- Midtrans webhook processing
- Product refresh webhook
- Low stock alerts
- Status endpoint

---

## 🔑 Key Concepts

### 1. User Sessions

Each user has a session object stored in memory:

```javascript
{
  currentTab: 'catalog',        // Current tab
  currentPage: 1,               // Current page
  currentCategory: null,        // Selected category
  selectedProduct: null,        // Viewing product
  selectedQuantity: 1,          // Selected quantity
  searchQuery: null,            // Search query
  searchResults: [],            // Search results
  favoriteProducts: [],         // Favorite list
  lastActivity: Date.now(),     // Last interaction
  language: 'id',               // User language
}
```

### 2. Order Lifecycle

```
Created → Pending → (Success/Failed/Timeout)
   ↓         ↓              ↓
 Stock    Payment        Stock
Reserved  Processing    Finalized/Released
```

### 3. State Management

```javascript
// Get session
const session = getUserSession(userId);

// Update session
updateUserSession(userId, { currentPage: 2 });

// Check rate limit
if (!checkRateLimit(userId, cooldown)) {
  return; // Too soon
}

// Manage favorites
addToFavorites(userId, productCode);
removeFromFavorites(userId, productCode);
isFavorited(userId, productCode);

// Record analytics
recordProductView(productCode);
recordSearchQuery(query);
recordOrder(orderId, userId, amount, productCode);
```

---

## ➕ Adding Features

### Adding a New Command

1. **Create handler in `commands.js`:**

```javascript
export async function handleMyCommand(ctx) {
  const userId = ctx.from.id;
  
  // Your logic here
  await ctx.reply('My response');
}
```

2. **Register in `bot-telegram/index.js`:**

```javascript
bot.command('mycommand', handleMyCommand);
```

### Adding a Callback Action

1. **Create handler in `callbacks.js`:**

```javascript
async function handleMyAction(ctx, params) {
  const [param1, param2] = params;
  
  // Your logic here
  await ctx.editMessageText('Updated text');
  await ctx.answerCbQuery();
}
```

2. **Add to router in `handleCallbackQuery`:**

```javascript
case 'myaction':
  await handleMyAction(ctx, params);
  break;
```

3. **Use in keyboard:**

```javascript
Markup.button.callback('My Button', 'myaction:param1:param2')
```

### Adding Analytics Tracking

```javascript
// In state.js, add new metric
export const ANALYTICS = {
  // ... existing metrics
  myMetric: new Map(),
};

// Track event
export function recordMyEvent(data) {
  const count = ANALYTICS.myMetric.get(data) || 0;
  ANALYTICS.myMetric.set(data, count + 1);
}

// Get stats
export function getMyStats() {
  return Array.from(ANALYTICS.myMetric.entries())
    .sort((a, b) => b[1] - a[1]);
}
```

---

## ✅ Best Practices

### 1. Error Handling

```javascript
try {
  // Operation
  await someAsyncOperation();
} catch (error) {
  console.error('[MODULE] Operation failed:', error);
  await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
}
```

### 2. Rate Limiting

```javascript
if (!checkRateLimit(userId, BOT_CONFIG.USER_COOLDOWN_MS)) {
  return ctx.answerCbQuery('⏳ Tunggu sebentar...');
}
```

### 3. Message Updates

```javascript
// Always answer callback queries
await ctx.answerCbQuery();

// Prefer edit over new message
await ctx.editMessageText(newText, options);
```

### 4. State Management

```javascript
// Always update session on interaction
const session = getUserSession(userId);
updateUserSession(userId, { lastActivity: Date.now() });
```

### 5. Logging

```javascript
// Use descriptive log prefixes
console.log('[PURCHASE] Creating order:', orderId);
console.error('[WEBHOOK] Failed to process:', error);
console.warn('[CACHE] Using stale data');
```

### 6. Async/Await

```javascript
// Always use try/catch with async
async function myFunction() {
  try {
    await operation();
  } catch (error) {
    // Handle error
  }
}

// Use Promise.all for parallel operations
const [data1, data2] = await Promise.all([
  fetchData1(),
  fetchData2(),
]);
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Bot starts successfully
- [ ] /start shows welcome message
- [ ] /menu displays catalog with pagination
- [ ] Search works correctly
- [ ] Product detail shows correct info
- [ ] Quantity adjustment works
- [ ] Buy creates order and QR
- [ ] Payment webhook processes correctly
- [ ] Digital items delivered
- [ ] Favorites add/remove works
- [ ] History shows past orders
- [ ] Admin commands restricted
- [ ] Dashboard shows stats
- [ ] Broadcast works

### Testing Purchase Flow

```bash
# 1. Buy product
/buy DEMO1 1

# 2. Scan QR and pay in Midtrans sandbox

# 3. Verify webhook received
# Check logs for: [WEBHOOK] Order: PBS-xxx, Status: settlement

# 4. Verify user received items
# Check chat for receipt message

# 5. Check order removed from active
/admin orders
```

---

## 🚀 Deployment

### Production Checklist

- [ ] Update `.env` with production values
- [ ] Set `MIDTRANS_IS_PRODUCTION=true`
- [ ] Configure `PUBLIC_BASE_URL` with HTTPS domain
- [ ] Set webhook in Midtrans dashboard
- [ ] Test webhook connectivity
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificate
- [ ] Configure firewall rules
- [ ] Set up monitoring
- [ ] Configure log rotation
- [ ] Set up backup system
- [ ] Test failover scenarios

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start bot-telegram/index.js --name pbs-bot

# Save process list
pm2 save

# Setup startup script
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs pbs-bot
```

### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "bot-telegram/index.js"]
```

```bash
# Build
docker build -t pbs-bot .

# Run
docker run -d \
  --name pbs-bot \
  --env-file .env \
  -p 3000:3000 \
  pbs-bot
```

---

## 📊 Monitoring

### Key Metrics to Monitor

- Active users (sessions)
- Orders per hour
- Success rate
- Average response time
- Error rate
- Memory usage
- CPU usage

### Health Check Endpoint

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok"}

curl http://localhost:3000/status
# Returns detailed status
```

---

## 🐛 Debugging

### Enable Debug Logs

```bash
NODE_OPTIONS=--trace-warnings node bot-telegram/index.js
```

### Common Issues

**Bot not responding:**
- Check bot token
- Verify webhook URL accessible
- Check firewall/port

**Products not loading:**
- Verify SHEET_URL format
- Check sheet permissions
- Test URL in browser

**Payment not working:**
- Check Midtrans credentials
- Verify webhook endpoint
- Check signature verification

---

## 📚 Resources

- [Telegraf Documentation](https://telegraf.js.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Midtrans API Docs](https://docs.midtrans.com/)
- [Google Sheets API](https://developers.google.com/sheets/api)

---

**Happy Coding! 🚀**
