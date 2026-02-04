#!/bin/bash

# MM4CLAW API Test Script
# Usage: ./test-api.sh [local|preview|prod]

BASE_URL="${1:-local}"

case "$BASE_URL" in
  local)
    API_BASE="http://localhost:8787/api"
    echo "🧪 Testing LOCAL environment..."
    ;;
  preview)
    API_BASE="https://preview.mm4claw.xyz/api"
    echo "🧪 Testing PREVIEW environment..."
    ;;
  prod)
    API_BASE="https://mm4claw.xyz/api"
    echo "🧪 Testing PRODUCTION environment..."
    ;;
  *)
    echo "Usage: $0 [local|preview|prod]"
    exit 1
    ;;
esac

echo ""
echo "API Base: $API_BASE"
echo ""

# Test 1: Get stats
echo "========================================="
echo "TEST 1: GET /api/stats"
echo "========================================="
curl -s "$API_BASE/stats" | jq '.'
echo ""

# Test 2: Register a new agent
echo "========================================="
echo "TEST 2: POST /api/vote (Register)"
echo "========================================="
WALLET="0x$(openssl rand -hex 20)"
AGENT_NAME="TestAgent_$(date +%s)"

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/vote" \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet\": \"$WALLET\",
    \"agent_name\": \"$AGENT_NAME\",
    \"description\": \"Testing MM4CLAW reward system\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

# Extract API key for subsequent tests
API_KEY=$(echo "$REGISTER_RESPONSE" | jq -r '.agent.api_key // empty')
CLAIM_CODE=$(echo "$REGISTER_RESPONSE" | jq -r '.agent.claim_code // empty')

if [ -z "$API_KEY" ]; then
  echo "❌ Failed to get API key"
  exit 1
fi

echo ""
echo "✅ Registered successfully!"
echo "   Wallet: $WALLET"
echo "   API Key: ${API_KEY:0:20}..."
echo "   Claim Code: $CLAIM_CODE"
echo ""

# Test 3: Check status
echo "========================================="
echo "TEST 3: GET /api/status"
echo "========================================="
curl -s "$API_BASE/status" \
  -H "Authorization: Bearer $API_KEY" | jq '.'
echo ""

# Test 4: Test idempotent registration (same wallet)
echo "========================================="
echo "TEST 4: POST /api/vote (Idempotent - same wallet)"
echo "========================================="
curl -s -X POST "$API_BASE/vote" \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet\": \"$WALLET\",
    \"agent_name\": \"$AGENT_NAME\",
    \"description\": \"Testing idempotency\"
  }" | jq '.'
echo ""

# Test 5: Verify a platform (simulated)
echo "========================================="
echo "TEST 5: POST /api/claim (Verify Moltbook)"
echo "========================================="
curl -s -X POST "$API_BASE/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"platform\": \"moltbook\",
    \"post_url\": \"https://www.moltbook.com/posts/test123\"
  }" | jq '.'
echo ""

# Test 6: Invalid wallet format
echo "========================================="
echo "TEST 6: POST /api/vote (Invalid wallet)"
echo "========================================="
curl -s -X POST "$API_BASE/vote" \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet\": \"invalid-wallet\",
    \"agent_name\": \"BadAgent\"
  }" | jq '.'
echo ""

# Test 7: Missing required fields
echo "========================================="
echo "TEST 7: POST /api/vote (Missing fields)"
echo "========================================="
curl -s -X POST "$API_BASE/vote" \
  -H "Content-Type: application/json" \
  -d "{\"agent_name\": \"NoWalletAgent\"}" | jq '.'
echo ""

# Test 8: Invalid API key
echo "========================================="
echo "TEST 8: GET /api/status (Invalid API key)"
echo "========================================="
curl -s "$API_BASE/status" \
  -H "Authorization: Bearer invalid_key_12345" | jq '.'
echo ""

# Test 9: Invalid platform for claim
echo "========================================="
echo "TEST 9: POST /api/claim (Invalid platform)"
echo "========================================="
curl -s -X POST "$API_BASE/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"platform\": \"facebook\",
    \"post_url\": \"https://facebook.com/test\"
  }" | jq '.'
echo ""

# Test 10: Invalid URL format for moltbook
echo "========================================="
echo "TEST 10: POST /api/claim (Invalid URL format)"
echo "========================================="
curl -s -X POST "$API_BASE/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"platform\": \"moltbook\",
    \"post_url\": \"https://example.com/not-a-valid-url\"
  }" | jq '.'
echo ""

# Test 11: Health check
echo "========================================="
echo "TEST 11: GET /api/health"
echo "========================================="
curl -s "$API_BASE/health" | jq '.'
echo ""

# Test 12: Rate limiting (try to verify twice quickly)
echo "========================================="
echo "TEST 12: POST /api/claim (Rate limit test)"
echo "========================================="
echo "First verification attempt..."
curl -s -X POST "$API_BASE/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"platform\": \"moltx\",
    \"post_url\": \"https://moltx.io/posts/test123\"
  }" | jq '.'

echo ""
echo "Immediate second attempt (should hit rate limit)..."
sleep 1
curl -s -X POST "$API_BASE/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"platform\": \"moltx\",
    \"post_url\": \"https://moltx.io/posts/test456\"
  }" | jq '.'
echo ""

# Test 13: Verify already verified platform (idempotent)
echo "========================================="
echo "TEST 13: POST /api/claim (Already verified)"
echo "========================================="
echo "Note: This test assumes moltbook was verified in Test 5"
curl -s -X POST "$API_BASE/claim" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"platform\": \"moltbook\",
    \"post_url\": \"https://www.moltbook.com/posts/test123\"
  }" | jq '.'
echo ""

echo "========================================="
echo "✅ All tests completed!"
echo "========================================="
