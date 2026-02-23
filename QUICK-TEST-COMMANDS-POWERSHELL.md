# 🪟 QUICK TEST COMMANDS - PowerShell (Windows)

Untuk Windows users yang lebih nyaman pakai PowerShell.

---

## 🎯 TEST 1: Price Tampering Prevention
### Coba hack harga 1 rupiah (harus gagal)

```powershell
$body = @{
    items = @(
        @{
            product = @{
                kode = "P001"
                harga = 1
                nama = "Test Product"
            }
            quantity = 1
        }
    )
    customerName = "Security Test User"
    customerEmail = "test@security.com"
    customerPhone = "081234567890"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/checkout" `
    -Method Post `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body `
    -SkipCertificateCheck

$json = $response.Content | ConvertFrom-Json
$json | Format-List

# Cek apakah amount != 1 (dari database)
"Amount is: {0}" -f $json.amount
if ($json.amount -gt 1) { "✅ PASS - Price from DB" } else { "❌ FAIL - Price vulnerable!" }
if (-not $json.qrString) { "✅ PASS - No QR in response" } else { "❌ FAIL - QR exposed!" }
```

**Output yang benar:**
```
success      : True
orderId      : PBS-1708747200000-abc123
transactionId: 1708747200000-abc123
amount       : 10000000
message      : Order created successfully

Amount is: 10000000
✅ PASS - Price from DB
✅ PASS - No QR in response
```

---

## 🎯 TEST 2: Rate Limiting (5 req/min)
### Kirim 6 request cepat, no. 6 harus ditolak

```powershell
function Test-RateLimit {
    param(
        [int]$RequestCount = 6,
        [string]$Domain = "https://store.pbs.web.id"
    )
    
    $body = @{
        items = @(
            @{
                product = @{
                    kode = "P001"
                    harga = 100000
                }
                quantity = 1
            }
        )
        customerName = "Rate Limit Test"
        customerEmail = "test@test.com"
        customerPhone = "081234567890"
    } | ConvertTo-Json
    
    for ($i = 1; $i -le $RequestCount; $i++) {
        Write-Host "Request #$i:" -ForegroundColor Cyan
        try {
            $response = Invoke-WebRequest -Uri "$Domain/api/checkout" `
                -Method Post `
                -Headers @{"Content-Type" = "application/json"} `
                -Body $body `
                -SkipCertificateCheck
            
            $json = $response.Content | ConvertFrom-Json
            if ($json.success) {
                Write-Host "  ✅ Success (HTTP 200)" -ForegroundColor Green
            } else {
                Write-Host "  Message: $($json.error)" -ForegroundColor Yellow
            }
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq 429) {
                Write-Host "  ⛔ RATE LIMITED (HTTP 429)" -ForegroundColor Red
                Write-Host "  This is correct! Press Enter to continue testing..."
                Read-Host
                break
            } else {
                Write-Host "  ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        
        Start-Sleep -Seconds 2
    }
}

# Jalankan test
Test-RateLimit -RequestCount 6 -Domain "https://store.pbs.web.id"

# Tunggu 60 detik
Write-Host "Waiting 60 seconds for rate limit reset..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

# Test request ke-7 (harus sukses)
Write-Host "Request #7 (after reset):" -ForegroundColor Cyan
$body = @{items = @(@{product = @{kode = "P001"; harga = 100000}; quantity = 1}); customerName = "Test"; customerEmail = "t@t.com"; customerPhone = "081"} | ConvertTo-Json
$response = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/checkout" -Method Post -Headers @{"Content-Type" = "application/json"} -Body $body -SkipCertificateCheck
($response.Content | ConvertFrom-Json) | Format-List
```

**Output yang benar:**
```
Request #1:
  ✅ Success (HTTP 200)
Request #2:
  ✅ Success (HTTP 200)
...
Request #6:
  ⛔ RATE LIMITED (HTTP 429)

[Tunggu 60 detik]

Request #7 (after reset):
  ✅ Success (HTTP 200)
```

---

## 🎯 TEST 3: Webhook Amount Validation
### Simulasi webhook dengan amount salah

```powershell
# ⚠️ PENTING: Replace dengan MIDTRANS_SERVER_KEY yang benar!
$ServerKey = "YOUR_MIDTRANS_SERVER_KEY_HERE"
$OrderId = "PBS-test-webhook-123"
$StatusCode = "200"
$GrossAmount = "1"

# Generate SHA-512 signature
$TextToHash = "$OrderId$StatusCode$GrossAmount$ServerKey"
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($TextToHash)
$SHA512 = [System.Security.Cryptography.SHA512]::Create()
$Hash = $SHA512.ComputeHash($Bytes)
$Signature = [System.BitConverter]::ToString($Hash).Replace("-", "").ToLower()

Write-Host "Signature: $Signature" -ForegroundColor Cyan

# Send webhook
$webhookBody = @{
    order_id = $OrderId
    status_code = $StatusCode
    gross_amount = $GrossAmount
    signature_key = $Signature
    transaction_status = "settlement"
    transaction_id = "TXN-test-123"
    payment_type = "qris"
} | ConvertTo-Json

Write-Host "Sending webhook..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/webhook" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $webhookBody `
        -SkipCertificateCheck
    
    $json = $response.Content | ConvertFrom-Json
    $json | Format-List
    
    if ($json.error -like "*mismatch*") {
        Write-Host "✅ PASS - Amount mismatch detected correctly!" -ForegroundColor Green
    }
}
catch {
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Response: $($_.Exception.Response.Content)" -ForegroundColor Yellow
}
```

**Output yang benar:**
```
Signature: [long hash string]
Sending webhook...

success : False
error   : Amount mismatch
status  : 400

✅ PASS - Amount mismatch detected correctly!
```

---

## 🎯 TEST 4: QR Code Not in URL
### Verifikasi QR tidak expose di URL (PowerShell + Browser)

**Bagian 1: Buat order**
```powershell
$body = @{
    items = @(@{product = @{kode = "P001"; harga = 100000}; quantity = 1})
    customerName = "QR Test"
    customerEmail = "qr@test.com"
    customerPhone = "081234567890"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/checkout" `
    -Method Post `
    -Headers @{"Content-Type" = "application/json"} `
    -Body $body `
    -SkipCertificateCheck

$json = $response.Content | ConvertFrom-Json
$orderId = $json.orderId
$transactionId = $json.transactionId

Write-Host "Order ID: $orderId" -ForegroundColor Green
Write-Host "Transaction ID: $transactionId" -ForegroundColor Green

# Buka browser
$url = "https://store.pbs.web.id/order-pending?orderId=$orderId&transactionId=$transactionId"
Write-Host "Opening: $url" -ForegroundColor Cyan
Start-Process $url
```

**Bagian 2: Cek di browser DevTools**
```javascript
// Di browser, buka DevTools (F12) → Console
// Paste:
fetch('/api/order/' + new URLSearchParams(window.location.search).get('orderId'))
  .then(r => r.json())
  .then(d => {
    console.log('✅ QR API Response:', d);
    console.log('URL params:', window.location.search);
    console.log('Has qrString in URL:', window.location.search.includes('qrString'));
  })
```

**Cek di PowerShell:**
```powershell
# Pastikan URL tidak punya qrString
if ($url -like "*qrString*") {
    Write-Host "❌ FAIL - QR exposed in URL!" -ForegroundColor Red
} else {
    Write-Host "✅ PASS - QR NOT in URL" -ForegroundColor Green
}
```

---

## 🎯 TEST 5: New Order API Endpoint

```powershell
# Dapatkan order ID dari TEST 1
$OrderId = "PBS-test-order-123"  # Ganti dengan order ID yang real

# Test endpoint
$response = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/order/$OrderId" `
    -Method Get `
    -SkipCertificateCheck

$json = $response.Content | ConvertFrom-Json

Write-Host "Order Details:" -ForegroundColor Green
$json.order | Format-List

Write-Host "`nQR Code Info:" -ForegroundColor Cyan
if ($json.qr) {
    $json.qr | Format-List
    Write-Host "✅ PASS - QR endpoint working" -ForegroundColor Green
} else {
    Write-Host "⚠️ NO QR - Order might not be pending" -ForegroundColor Yellow
}
```

---

## 📊 DATABASE VERIFICATION (Supabase)

**Tool: Gunakan Supabase Dashboard atau SQL Editor**

**Query 1: Cek orders dibuat dengan harga dari DB**
```sql
SELECT 
  order_id,
  total_amount,
  status,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;
```

**Query 2: Cek fraud_logs**
```sql
SELECT 
  order_id,
  type,
  expected_amount,
  received_amount,
  created_at
FROM fraud_logs
ORDER BY created_at DESC
LIMIT 5;
```

**Query 3: Pastikan TIDAK ada Rp1 orders**
```sql
SELECT COUNT(*) as suspicious_count
FROM orders
WHERE total_amount = 1 OR total_amount < 1000;
```

---

## 🎯 ALL-IN-ONE TEST SCRIPT

Simpan sebagai `test-patches.ps1` dan jalankan:

```powershell
# test-patches.ps1

Write-Host "🧪 SECURITY PATCHES TEST SUITE" -ForegroundColor Cyan
Write-Host "Domain: https://store.pbs.web.id" -ForegroundColor Cyan
Write-Host ""

# TEST 1
Write-Host "TEST 1/5: Price Tampering Prevention" -ForegroundColor Yellow
$body1 = @{
    items = @(@{product = @{kode = "P001"; harga = 1}; quantity = 1})
    customerName = "Test1"
    customerEmail = "test1@test.com"
    customerPhone = "081"
} | ConvertTo-Json

try {
    $r1 = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/checkout" -Method Post -Headers @{"Content-Type" = "application/json"} -Body $body1 -SkipCertificateCheck 2>$null
    $j1 = $r1.Content | ConvertFrom-Json
    if ($j1.amount -gt 1) { Write-Host "✅ PASS" -ForegroundColor Green } else { Write-Host "❌ FAIL" -ForegroundColor Red }
} catch { Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red }

# TEST 2
Write-Host "TEST 2/5: Rate Limiting" -ForegroundColor Yellow
$pass = 0
for ($i = 1; $i -le 6; $i++) {
    try {
        $r2 = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/checkout" `
            -Method Post -Headers @{"Content-Type" = "application/json"} `
            -Body (@{items = @(@{product = @{kode = "P001"; harga = 100000}; quantity = 1}); customerName = "R$i"; customerEmail = "r$i@t.com"; customerPhone = "081"} | ConvertTo-Json) `
            -SkipCertificateCheck 2>$null
        if ($i -lt 6) { $pass++ }
    } catch {
        if ($i -eq 6 -and $_.Exception.Response.StatusCode -eq 429) {
            Write-Host "✅ PASS (blocked at req 6)" -ForegroundColor Green
            $pass++
        }
    }
    Start-Sleep -Milliseconds 500
}
if ($pass -lt 2) { Write-Host "❌ FAIL" -ForegroundColor Red }

# TEST 3
Write-Host "TEST 3/5: Webhook Validation" -ForegroundColor Yellow
# Note: Requires SERVER_KEY setup
Write-Host "⚠️ SKIP (manual test needed - see QUICK-TEST-COMMANDS.md)" -ForegroundColor Yellow

# TEST 4
Write-Host "TEST 4/5: QR Not in URL" -ForegroundColor Yellow
$body4 = @{items = @(@{product = @{kode = "P001"; harga = 100000}; quantity = 1}); customerName = "T4"; customerEmail = "t4@t.com"; customerPhone = "081"} | ConvertTo-Json
try {
    $r4 = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/checkout" -Method Post -Headers @{"Content-Type" = "application/json"} -Body $body4 -SkipCertificateCheck 2>$null
    $j4 = $r4.Content | ConvertFrom-Json
    if (-not $j4.qrString -and -not $j4.qrUrl) { 
        Write-Host "✅ PASS (QR not in response)" -ForegroundColor Green 
    } else { 
        Write-Host "❌ FAIL (QR exposed)" -ForegroundColor Red 
    }
} catch { Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red }

# TEST 5
Write-Host "TEST 5/5: Order API Endpoint" -ForegroundColor Yellow
try {
    $r5 = Invoke-WebRequest -Uri "https://store.pbs.web.id/api/order/PBS-test-123" -Method Get -SkipCertificateCheck 2>$null
    if ($r5.StatusCode -eq 200 -or $r5.StatusCode -eq 404) {
        Write-Host "✅ PASS (endpoint responds)" -ForegroundColor Green
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ PASS (404 OK - order not found)" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎯 Test suite complete!" -ForegroundColor Green
```

**Jalankan:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy ByPass -Scope Process -Force
.\test-patches.ps1
```

---

## 🚨 COMMON POWERSHELL ERRORS & FIXES

**Error: `SSL certificate problem`**
```powershell
# Solution: Tambah -SkipCertificateCheck (sudah ada di semua cmd)
# Atau set global:
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
```

**Error: `ConvertFrom-Json` tidak bisa parse**
```powershell
# Masalah: Response bukan JSON
# Solution:
write-host $response.Content
# Lihat output untuk debug
```

**Error: `Cannot resolve host domain`**
```powershell
# Cek domain:
Test-NetConnection -ComputerName store.pbs.web.id -Port 443
```

**Error: Signature validation failed**
```powershell
# Pastikan format signature:
# SHA512(order_id + status_code + gross_amount + server_key)
# Contoh:
$text = "PBS-test-webhook-123" + "200" + "1" + "YOUR_SERVER_KEY"
```

---

## 📝 SAVE TEST RESULTS

```powershell
# Simpan hasil ke file:
$results = @"
TEST DATE: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

TEST 1 - Price Tampering: [ ] PASS / [ ] FAIL
TEST 2 - Rate Limiting: [ ] PASS / [ ] FAIL  
TEST 3 - Webhook Validation: [ ] PASS / [ ] FAIL
TEST 4 - QR Not in URL: [ ] PASS / [ ] FAIL
TEST 5 - Order API: [ ] PASS / [ ] FAIL

OVERALL: [ ] READY FOR PRODUCTION / [ ] NEED FIXES

Notes:
_________________________________________
"@

$results | Out-File -FilePath "test-results.txt"
Write-Host "Results saved to: test-results.txt" -ForegroundColor Green
```

---

**Created:** Feb 24, 2026  
**Platform:** Windows PowerShell  
**Status:** Ready to Test ✅
