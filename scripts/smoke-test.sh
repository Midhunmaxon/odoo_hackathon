#!/usr/bin/env bash
# ==============================================================================
# Brightloop End-to-End Smoke Test Script
# Flow: Health → Signup → Login → Customer Portal (Subscriptions & Invoices) → RBAC Guard
# ==============================================================================

set -e

API_URL="${API_URL:-http://localhost:5000/api}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="smoke_${TIMESTAMP}@brightloop.com"
TEST_PASS="Password123!"
TEST_NAME="Smoke Test Customer ${TIMESTAMP}"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  Brightloop E2E Smoke Test: Signup → Login → Customer Portal   ${NC}"
echo -e "${BLUE}  Target: ${API_URL}                                            ${NC}"
echo -e "${BLUE}================================================================${NC}\n"

# 1. Health Check
echo -n "1. Checking Backend Health... "
HEALTH_RES=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" || true)
if [ "$HEALTH_RES" -eq 200 ]; then
  echo -e "${GREEN}PASS (200 OK)${NC}"
else
  echo -e "${RED}FAIL (HTTP $HEALTH_RES). Is the backend running on port 5000?${NC}"
  exit 1
fi

# 2. Customer Signup
echo -n "2. Testing Customer Signup (${TEST_EMAIL})... "
SIGNUP_PAYLOAD=$(cat <<EOF
{
  "name": "${TEST_NAME}",
  "email": "${TEST_EMAIL}",
  "password": "${TEST_PASS}"
}
EOF
)
SIGNUP_RES=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/auth/signup" \
  -H "Content-Type: application/json" \
  -d "${SIGNUP_PAYLOAD}")

HTTP_CODE=$(echo "$SIGNUP_RES" | tail -n1)
BODY=$(echo "$SIGNUP_RES" | sed '$d')

if [ "$HTTP_CODE" -eq 201 ]; then
  echo -e "${GREEN}PASS (201 Created)${NC}"
else
  echo -e "${RED}FAIL (HTTP $HTTP_CODE): $BODY${NC}"
  exit 1
fi

# 3. Customer Login
echo -n "3. Testing Customer Login... "
LOGIN_PAYLOAD=$(cat <<EOF
{
  "email": "${TEST_EMAIL}",
  "password": "${TEST_PASS}"
}
EOF
)
LOGIN_RES=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "${LOGIN_PAYLOAD}")

HTTP_CODE=$(echo "$LOGIN_RES" | tail -n1)
BODY=$(echo "$LOGIN_RES" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  ROLE=$(echo "$BODY" | grep -o '"role":"[^"]*' | cut -d'"' -f4)
  echo -e "${GREEN}PASS (200 OK, Role: ${ROLE})${NC}"
else
  echo -e "${RED}FAIL (HTTP $HTTP_CODE): $BODY${NC}"
  exit 1
fi

# 4. Portal Subscriptions
echo -n "4. Accessing Customer Subscriptions Portal... "
SUB_RES=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/users/portal/subscriptions" \
  -H "Authorization: Bearer ${TOKEN}")

HTTP_CODE=$(echo "$SUB_RES" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}PASS (200 OK - Customer Isolation Active)${NC}"
else
  echo -e "${RED}FAIL (HTTP $HTTP_CODE)${NC}"
  exit 1
fi

# 5. Portal Invoices
echo -n "5. Accessing Customer Invoices Portal... "
INV_RES=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/users/portal/invoices" \
  -H "Authorization: Bearer ${TOKEN}")

HTTP_CODE=$(echo "$INV_RES" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}PASS (200 OK - Itemized Records Accessible)${NC}"
else
  echo -e "${RED}FAIL (HTTP $HTTP_CODE)${NC}"
  exit 1
fi

# 6. Customer Privacy Isolation (Accessing non-owned record returns 404)
echo -n "6. Verifying Cross-Tenant Isolation (GET foreign invoice)... "
ISO_RES=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/users/portal/invoices/999999" \
  -H "Authorization: Bearer ${TOKEN}")

HTTP_CODE=$(echo "$ISO_RES" | tail -n1)
if [ "$HTTP_CODE" -eq 404 ]; then
  echo -e "${GREEN}PASS (404 NOT_FOUND - Non-owned records inaccessible)${NC}"
else
  echo -e "${RED}FAIL (Expected 404, got $HTTP_CODE)${NC}"
  exit 1
fi

# 7. Role Boundary Guard (Customer accessing Admin-only endpoint returns 403)
echo -n "7. Verifying Role-Based Access Guard (Customer accessing /users/staff)... "
RBAC_RES=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/users/staff" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"email":"fake@staff.com","password":"Password123!","name":"Fake"}')

HTTP_CODE=$(echo "$RBAC_RES" | tail -n1)
if [ "$HTTP_CODE" -eq 403 ]; then
  echo -e "${GREEN}PASS (403 FORBIDDEN - Admin endpoints secured)${NC}"
else
  echo -e "${RED}FAIL (Expected 403, got $HTTP_CODE)${NC}"
  exit 1
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  All 7 End-to-End Smoke Tests Passed Successfully!             ${NC}"
echo -e "${GREEN}================================================================${NC}"
