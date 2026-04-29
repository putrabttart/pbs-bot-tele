# Flow Pembelian & Pengiriman Item

## Overview - Complete Purchase Flow

```
USER → CHECKOUT → PAYMENT → ORDER SUCCESS → ITEM SENT
```

---

## Step-by-Step Flow

### 1. **CHECKOUT** (User Input Data)
- URL: `http://localhost:3001/checkout`
- User isi form:
  - Nama Lengkap
  - Email
  - No. Telepon
- Click "Bayar Sekarang"

### 2. **CREATE QRIS TRANSACTION**
**Endpoint:** `POST /api/checkout`

**Input:** 
```json
{
  "items": [
    {
      "product": {
        "id": "uuid",
        "nama": "Product Name",
        "harga": 50000,
        "kode": "ABC123"
      },
      "quantity": 2
    }
  ],
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "08123456789"
}
```

**Process:**
1. Validate cart items
2. Calculate total amount
3. Create Direct QRIS transaction via Midtrans API
4. **Save order to database** (orders table)
5. Return QRIS details with QR code string

**Database Saved:**
```
orders table:
- order_id (PBS-1234567890)
- transaction_id (from Midtrans)
- customer_name
- customer_email
- customer_phone
- total_amount
- status: 'pending'
- payment_method: 'qris'
- items: [array of items]
```

### 3. **PAYMENT PAGE** (QRIS Display)
- URL: `/order-pending?orderId=PBS-123&qrString=...&qrUrl=...`
- Display:
  - QR Code image
  - Instructions cara pembayaran
  - Order ID & Transaction ID
  - Button: "Cek Status Pembayaran"

### 4. **USER SCAN QRIS & PAY**
- Customer buka e-wallet/mobile banking
- Scan QR Code
- Verifikasi & transfer
- Payment terselesaikan di Midtrans

### 5. **WEBHOOK NOTIFICATION**
**Endpoint:** `POST /api/webhook`

**Triggered by:** Midtrans notification saat payment berhasil

**Process:**
1. Verify signature (security)
2. Check `transaction_status` = 'settlement' atau 'capture'
3. **Update order status** → 'paid'
4. **Update paid_at timestamp**
5. Log notification untuk admin

**Database Updated:**
```
orders table:
- status: 'paid' (dari 'pending')
- paid_at: timestamp pembayaran
```

### 6. **ORDER SUCCESS PAGE**
**Triggered:** Saat user click "Cek Status Pembayaran" atau browser intercept payment success

**URL:** `/order-success?orderId=PBS-123`

**Process:**
1. Fetch order details from Midtrans API
2. Display:
   - ✓ Pembayaran Berhasil message
   - Order information (ID, Transaction ID, Time)
   - Customer data (Name, Email, Phone)
   - **LIST OF ITEMS PURCHASED** ← Items yang dibeli ditampilkan di sini
   - Total payment amount
   - Next steps (order processing info)
3. Show WhatsApp contact button

**Flow dalam halaman:**
```
Order-Success Page
├─ Success Header
├─ Order Information
│  ├─ Order ID
│  ├─ Transaction ID
│  ├─ Payment Time
│  └─ Status Badge
├─ Customer Data
│  ├─ Nama
│  ├─ Email
│  └─ Telepon
├─ ITEM PEMBELIAN (dari transaction item_details)
│  ├─ Item 1: Product Name × Qty @ Price = Subtotal
│  ├─ Item 2: Product Name × Qty @ Price = Subtotal
│  └─ TOTAL: Rp XXX
├─ Next Steps
│  1. Order diterima & diproses
│  2. Persiapan item
│  3. Notifikasi pengiriman
│  4. Terima item
└─ Sidebar
   ├─ WhatsApp Support Button
   └─ Navigation Buttons
```

---

## Database Schema Integration

### Orders Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_id TEXT UNIQUE,           -- PBS-1234567890
  transaction_id TEXT,            -- Midtrans transaction ID
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  total_amount NUMERIC,
  status TEXT,                    -- pending → paid
  payment_method TEXT,            -- qris
  items JSONB,                    -- Array of items
  paid_at TIMESTAMP,              -- Saat pembayaran berhasil
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Items Structure (dalam JSONB)
```json
{
  "items": [
    {
      "product_id": "uuid",
      "product_name": "VIU Premium 1 Tahun",
      "product_code": "VIU001",
      "quantity": 2,
      "price": 50000
    }
  ]
}
```

---

## Comparison with Bot Flow

### Bot (Telegram)
```
1. User /order → Create QRIS
2. QR terkirim ke Telegram chat
3. User scan & bayar
4. Webhook: settlement → finalize_items_for_order
5. Get digital items dari product_items table
6. Send items to user via Telegram (text file)
```

### Web (Next.js)
```
1. User checkout → Create QRIS
2. QR display di web page
3. User scan & bayar
4. Webhook: settlement → Update order status
5. User buka /order-success → Fetch order items
6. Display items list di web page
```

**Kesamaan:**
- ✅ Sama-sama menggunakan Midtrans Direct QRIS Charge
- ✅ Sama-sama trigger webhook saat pembayaran berhasil
- ✅ Sama-sama display items setelah payment success
- ✅ Sama-sama simpan ke database

**Perbedaan:**
- Bot: Items dikirim via Telegram message
- Web: Items ditampilkan di halaman web (order-success)

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/checkout` | Create order & QRIS transaction |
| POST | `/api/webhook` | Midtrans payment notification |
| GET | `/api/orders/[orderId]` | Get order details |
| POST | `/api/payment-status` | Check payment status |

---

## Testing Flow

1. **Add Product to Cart**
   - Go to http://localhost:3001
   - Click product → Add quantity → Add to cart

2. **Go to Checkout**
   - Click checkout button
   - Fill form

3. **Create QRIS Payment**
   - Click "Bayar Sekarang"
   - System create QRIS transaction
   - Redirect to /order-pending with QR code

4. **Simulate Payment**
   - Midtrans dashboard → Test payment
   - Or use Midtrans test app
   - Payment berhasil → Webhook triggered

5. **Check Order Success Page**
   - Click "Cek Status Pembayaran"
   - See order details + items
   - Or wait for webhook to trigger redirect

---

## Files Modified/Created

### New Files
- `app/api/orders/[orderId]/route.ts` - Get order details
- `app/api/webhook/route.ts` - Payment notification handler (updated)

### Modified Files
- `app/api/checkout/route.ts` - Save order to DB + return items
- `app/order-success/page.tsx` - Complete redesign to show order + items
- `app/order-pending/page.tsx` - Fixed to show QRIS properly
- `app/checkout/page.tsx` - Fixed cart clearing issue

### Configuration
- `WEBHOOK-SETUP.md` - Setup guide for ngrok & webhook
- `.env.local` - Production Midtrans credentials

---

## Future Enhancements

1. **Admin Dashboard**
   - View all orders
   - Update order status
   - Send shipping notification

2. **Order Tracking**
   - Customer can track order status
   - Timeline: Pending → Paid → Shipped → Delivered

3. **Email Notifications**
   - Order confirmation
   - Payment receipt
   - Shipping notification

4. **Product Items Auto-Assignment**
   - When payment received, automatically assign digital items
   - Display items immediately on order-success page
   - Similar to bot's finalize_items_for_order

5. **Webhook Integration with Bot**
   - Send order notification to bot
   - Bot notifies admin
   - Admin fulfill & update status
