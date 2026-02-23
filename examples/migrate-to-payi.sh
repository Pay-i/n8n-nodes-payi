#!/usr/bin/env bash
#
# migrate-to-payi.sh
#
# Redirects existing n8n LLM credentials to route through Pay-i proxy.
# Uses the n8n REST API — works on both self-hosted and cloud instances.
#
# Supported credential types:
#   - OpenAI (openAiApi)         → base URL redirect
#   - Anthropic (anthropicApi)   → base URL redirect + xProxy-api-key header
#   - Azure OpenAI (azureOpenAiApi) → endpoint redirect
#
# Usage:
#   export N8N_BASE_URL=http://localhost:5678
#   export N8N_API_KEY=your-n8n-api-key
#   export PAYI_BASE_URL=https://api.yourcompany.pay-i.com
#   export PAYI_API_KEY=your-payi-api-key
#   ./migrate-to-payi.sh
#
# To revert, re-run with original provider URLs or edit credentials in the n8n UI.
#

set -euo pipefail

# ── Check required env vars ──────────────────────────────────────────────────

for VAR in N8N_BASE_URL N8N_API_KEY PAYI_BASE_URL PAYI_API_KEY; do
  if [[ -z "${!VAR:-}" ]]; then
    echo "ERROR: ${VAR} is not set"
    echo ""
    echo "Required environment variables:"
    echo "  N8N_BASE_URL   - Your n8n instance (e.g. http://localhost:5678)"
    echo "  N8N_API_KEY    - n8n API key (Settings > API > Create API Key)"
    echo "  PAYI_BASE_URL  - Pay-i instance (e.g. https://api.yourcompany.pay-i.com)"
    echo "  PAYI_API_KEY   - Your Pay-i API key"
    exit 1
  fi
done

if [[ ! "${PAYI_BASE_URL}" =~ ^https:// ]]; then
  echo "ERROR: PAYI_BASE_URL must start with https://"
  exit 1
fi

PAYI_BASE_URL="${PAYI_BASE_URL%/}"
N8N_BASE_URL="${N8N_BASE_URL%/}"

echo "══════════════════════════════════════════════════════════════"
echo "  Pay-i Migration Script for n8n LLM Credentials"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "  n8n instance:  ${N8N_BASE_URL}"
echo "  Pay-i base:    ${PAYI_BASE_URL}"
echo ""
echo "  Provider proxy URLs:"
echo "    OpenAI:       ${PAYI_BASE_URL}/api/v1/proxy/openai/v1"
echo "    Anthropic:    ${PAYI_BASE_URL}/api/v1/proxy/anthropic"
echo "    Azure OpenAI: ${PAYI_BASE_URL}/api/v1/proxy/azure.openai"
echo ""

# ── Fetch all credentials ────────────────────────────────────────────────────

echo "Fetching credentials from n8n..."
CREDS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  "${N8N_BASE_URL}/api/v1/credentials")

HTTP_CODE=$(echo "$CREDS_RESPONSE" | tail -1)
CREDS_BODY=$(echo "$CREDS_RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Failed to fetch credentials (HTTP ${HTTP_CODE})"
  echo "$CREDS_BODY"
  exit 1
fi

# ── Find matching credentials ────────────────────────────────────────────────

RESULTS=$(echo "$CREDS_BODY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
creds = data.get('data', data) if isinstance(data, dict) else data
supported = {'openAiApi', 'anthropicApi', 'azureOpenAiApi'}
found = [c for c in creds if c.get('type') in supported]
print(json.dumps(found))
" 2>/dev/null || echo "[]")

TOTAL=$(echo "$RESULTS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")

if [[ "$TOTAL" == "0" ]]; then
  echo "No OpenAI, Anthropic, or Azure OpenAI credentials found."
  echo ""
  echo "For AWS Bedrock, use the Pay-i Proxy node (n8n-nodes-payi) instead."
  exit 0
fi

echo "Found ${TOTAL} credential(s) to migrate:"
echo ""

echo "$RESULTS" | python3 -c "
import json, sys
creds = json.load(sys.stdin)
labels = {'openAiApi': 'OpenAI', 'anthropicApi': 'Anthropic', 'azureOpenAiApi': 'Azure OpenAI'}
for c in creds:
    label = labels.get(c['type'], c['type'])
    print(f\"  [{c['id']}] {c['name']} ({label})\")
"

echo ""
read -p "Proceed with migration? (y/N) " CONFIRM
if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi
echo ""

# ── Update credentials ───────────────────────────────────────────────────────

UPDATED=0
FAILED=0

echo "$RESULTS" | python3 -c "
import json, sys
creds = json.load(sys.stdin)
for c in creds:
    print(f\"{c['id']}|{c['type']}|{c['name']}\")
" | while IFS='|' read -r CRED_ID CRED_TYPE CRED_NAME; do

  case "${CRED_TYPE}" in
    openAiApi)
      PROXY_URL="${PAYI_BASE_URL}/api/v1/proxy/openai/v1"
      PATCH_DATA="{\"data\":{\"url\":\"${PROXY_URL}\"}}"
      LABEL="OpenAI"
      REVERT_URL="https://api.openai.com/v1"
      ;;
    anthropicApi)
      PROXY_URL="${PAYI_BASE_URL}/api/v1/proxy/anthropic"
      # Anthropic credentials support a custom header — inject xProxy-api-key
      PATCH_DATA="{\"data\":{\"url\":\"${PROXY_URL}\",\"header\":true,\"headerName\":\"xProxy-api-key\",\"headerValue\":\"${PAYI_API_KEY}\"}}"
      LABEL="Anthropic"
      REVERT_URL="https://api.anthropic.com"
      ;;
    azureOpenAiApi)
      PROXY_URL="${PAYI_BASE_URL}/api/v1/proxy/azure.openai"
      PATCH_DATA="{\"data\":{\"endpoint\":\"${PROXY_URL}\"}}"
      LABEL="Azure OpenAI"
      REVERT_URL=""
      ;;
    *)
      echo "  Skipping [${CRED_ID}] ${CRED_NAME} (unsupported type: ${CRED_TYPE})"
      continue
      ;;
  esac

  echo "Updating [${CRED_ID}] ${CRED_NAME} (${LABEL})..."
  echo "  → ${PROXY_URL}"

  UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PATCH \
    -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "${PATCH_DATA}" \
    "${N8N_BASE_URL}/api/v1/credentials/${CRED_ID}")

  UPDATE_CODE=$(echo "$UPDATE_RESPONSE" | tail -1)

  if [[ "$UPDATE_CODE" == "200" ]]; then
    echo "  ✓ Updated successfully"
    UPDATED=$((UPDATED + 1))
  else
    UPDATE_BODY=$(echo "$UPDATE_RESPONSE" | sed '$d')
    echo "  ✗ Failed (HTTP ${UPDATE_CODE})"
    echo "    ${UPDATE_BODY}"
    echo ""
    echo "  Manual fix: n8n UI > Credentials > ${CRED_NAME} > Base URL > ${PROXY_URL}"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

echo "══════════════════════════════════════════════════════════════"
echo "  Migration complete!"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  Anthropic credentials include the xProxy-api-key header automatically."
echo ""
echo "  OpenAI and Azure OpenAI credentials do NOT support custom headers"
echo "  in n8n's credential UI. For these providers, the Pay-i API key must"
echo "  be added at the network/infrastructure level, or consider switching"
echo "  to the Pay-i Proxy node (n8n-nodes-payi) which handles auth for you."
echo ""
echo "To revert:"
echo "  OpenAI:       Set base URL back to https://api.openai.com/v1"
echo "  Anthropic:    Set base URL back to https://api.anthropic.com"
echo "                and disable the custom header"
echo "  Azure OpenAI: Set endpoint back to your original Azure endpoint"
echo ""
echo "For AWS Bedrock, use the Pay-i Proxy node — n8n's Bedrock"
echo "credentials do not support base URL overrides."
