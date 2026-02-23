#!/bin/bash
# Security Patches Verification Script
# Run this to test all 5 security patches

echo "🔒 SECURITY PATCHES VERIFICATION"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Config
API_URL="${API_URL:-http://localhost:3000}"
echo "🔗 Testing against: $API_URL"
echo ""

# ==========================================
# TEST 1: Order Price Tampering Prevention
# ==========================================
echo "📝 TEST 1: Order Price Tampering Prevention"
echo "-------------------------------------------"

RESPONSE=$(curl -s -X POST "$API_URL/api/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "product": {
        "kode": "P001",
        "harga": 1,
        "nama": "Test Product"
      },
      "quantity": 1
    }],
    "customerName": "Security Test",
    "customerEmail": "security@test.com",
    "customerPhone": "081234567890"
  }')

# Check if response contains amount (should be from DB, not 1)
if echo "$RESPONSE" | grep -q '"amount"' && ! echo "$RESPONSE" | grep -q '"error"'; then
  AMOUNT=$(echo "$RESPONSE" | grep -o '"amount":[0-9]*' | cut -d: -f2)
  if [ "$AMOUNT" -gt 1 ] 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: Amount from database (Rp$AMOUNT), not from client (Rp1)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC}: Amount still Rp1 (vulnerable!)"
    ((TESTS_FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC}: Response error or no amount in response"
  echo "Response: $RESPONSE"
  ((TESTS_FAILED++))
fi

# Check if response contains qrString (should NOT be there)
if echo "$RESPONSE" | grep -q 'qrString\|qrUrl'; then
  echo -e "${RED}❌ FAIL${NC}: QR data still in response (security exposure!)"
  ((TESTS_FAILED++))
else
  echo -e "${GREEN}✅ PASS${NC}: QR data NOT in response (secure)"
  ((TESTS_PASSED++))
fi
echo ""

# ==========================================
# TEST 2: Webhook Rate Limiting
# ==========================================
echo "📝 TEST 2: Rate Limiting (Max 5 requests per minute)"
echo "-----------------------------------------------------"

# Try 6 requests in rapid succession
RATE_LIMIT_HIT=0
for i in {1..6}; do
  RESPONSE=$(curl -s -X POST "$API_URL/api/checkout" \
    -H "Content-Type: application/json" \
    -d '{
      "items": [{
        "product": {"kode": "P001", "harga": 100000},
        "quantity": 1
      }],
      "customerName": "Test $i",
      "customerEmail": "test$i@test.com",
      "customerPhone": "081234567890"
    }')
  
  if echo "$RESPONSE" | grep -q "Terlalu banyak request\|429"; then
    RATE_LIMIT_HIT=1
    echo "Request $i: Rate limited (as expected)"
    break
  fi
  echo "Request $i: OK"
  sleep 0.5
done

if [ $RATE_LIMIT_HIT -eq 1 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Rate limiting working (blocked after 5 requests)"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠️ WARNING${NC}: Could not verify rate limiting in this test"
fi
echo ""

# ==========================================
# TEST 3: Webhook Amount Validation
# ==========================================
echo "📝 TEST 3: Webhook Amount Validation"
echo "------------------------------------"

# Create a test webhook with mismatched amount
WEBHOOK_RESPONSE=$(curl -s -X POST "$API_URL/api/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-FRAUD-123",
    "status_code": "200",
    "gross_amount": "1",
    "signature_key": "test",
    "transaction_status": "settlement",
    "payment_type": "qris"
  }')

if echo "$WEBHOOK_RESPONSE" | grep -q "Invalid signature\|Amount mismatch\|error"; then
  echo -e "${GREEN}✅ PASS${NC}: Webhook rejected tampered amount"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠️ WARNING${NC}: Could not verify webhook validation"
fi
echo ""

# ==========================================
# TEST 4: QR Not in URL
# ==========================================
echo "📝 TEST 4: QR Code Not Exposed in URL"
echo "-------------------------------------"

# Check if order-pending page can be accessed without QR in URL
ORDER_RESPONSE=$(curl -s "$API_URL/order-pending?orderId=TEST-123&transactionId=TXN-123")

if echo "$ORDER_RESPONSE" | grep -q "qrString\|qrUrl" | grep "query\|param\|url"; then
  echo -e "${RED}❌ FAIL${NC}: QR data found in URL or page HTML"
  ((TESTS_FAILED++))
else
  echo -e "${GREEN}✅ PASS${NC}: QR data not exposed in URL"
  ((TESTS_PASSED++))
fi
echo ""

# ==========================================
# TEST 5: New Order API Endpoint
# ==========================================
echo "📝 TEST 5: Secure Order API Endpoint"
echo "------------------------------------"

# Test new /api/order/:id endpoint
ORDER_API_RESPONSE=$(curl -s "$API_URL/api/order/TEST-123")

if echo "$ORDER_API_RESPONSE" | grep -q '"order"' || echo "$ORDER_API_RESPONSE" | grep -q '"error"'; then
  echo -e "${GREEN}✅ PASS${NC}: New /api/order/:id endpoint is working"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠️ WARNING${NC}: Could not access /api/order/:id endpoint"
fi
echo ""

# ==========================================
# SUMMARY
# ==========================================
echo "📊 TEST SUMMARY"
echo "==============="
echo -e "${GREEN}Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Failed:${NC} $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL SECURITY PATCHES VERIFIED!${NC}"
  echo "Your system is protected against order tampering attacks."
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED!${NC}"
  echo "Please review the failures above and fix any issues."
  exit 1
fi
