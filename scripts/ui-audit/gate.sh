#!/usr/bin/env bash
# UI release gate: ONE command. Seed, start API + web, production build, tap-target audit, summary check.
# Usage (frontend repo root):  npm run ui:gate
# Tooling only. Touches no production code, no switch, no CI. Local only: it refuses anything but localhost.
#
# Needs (env, with defaults):
#   BACKEND_DIR   backend checkout            (default ../metpro-erp-backend-v2)
#   BACKEND_PY    python with backend deps    (default python3)
#   PGURL_ADMIN   admin URL on a local server (default postgresql://postgres:postgres@localhost:5432/postgres)
#   GATE_API_PORT (default 8100)   GATE_WEB_PORT (default 3800)
# Needs on the machine: postgres running locally, playwright resolvable through NODE_PATH (set below from the global root).
set -uo pipefail
cd "$(dirname "$0")/../.."
FE="$(pwd)"
BACKEND_DIR="$(cd "${BACKEND_DIR:-../metpro-erp-backend-v2}" && pwd)" || { echo "gate: BACKEND_DIR not found"; exit 2; }
BACKEND_PY="${BACKEND_PY:-python3}"
PGURL_ADMIN="${PGURL_ADMIN:-postgresql://postgres:postgres@localhost:5432/postgres}"
API_PORT="${GATE_API_PORT:-8100}"; WEB_PORT="${GATE_WEB_PORT:-3800}"
DB=metpro_gate
DBURL="postgresql://postgres:postgres@localhost:5432/$DB"
case "$PGURL_ADMIN" in *localhost*|*127.0.0.1*) ;; *) echo "gate: refused, PGURL_ADMIN must be local"; exit 2;; esac
for PT in "$API_PORT" "$WEB_PORT"; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$PT") 2>/dev/null; then echo "GATE FAIL: port $PT is already in use (a stale server would be audited instead of this build). Stop it first."; exit 2; fi
done
WORK="$(mktemp -d)"; T0=$(date +%s)
APIPID=""; WEBPID=""
cleanup() {
  [ -n "$APIPID" ] && kill "$APIPID" 2>/dev/null
  [ -n "$WEBPID" ] && { kill -- -"$WEBPID" 2>/dev/null || kill "$WEBPID" 2>/dev/null; }   # whole process group: npx spawns next-server
  ( cd "$FE" && git checkout -- next-env.d.ts 2>/dev/null )   # next build dirties it
  echo "gate: work files in $WORK"
}
trap cleanup EXIT
step() { echo; echo "== gate [$(( $(date +%s) - T0 ))s] $*"; }
fail() { echo "GATE FAIL: $*"; exit 1; }

step "1/6 fresh local database $DB (schema + migrations from the backend CI list)"
psql "$PGURL_ADMIN" -q -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB" || fail "cannot create $DB (is postgres running locally?)"
WF="$BACKEND_DIR/.github/workflows/tests.yml"
grep -o -- "-f [^ ]*\.sql" "$WF" | awk '{print $2}' | while read -r f; do
  psql "$DBURL" -v ON_ERROR_STOP=1 -q -f "$BACKEND_DIR/$f" >/dev/null || { echo "migration failed: $f"; exit 1; }
done || fail "schema load"

step "2/6 start API on :$API_PORT (all feature switches on, test mode)"
SECRET="gate-$(date +%s)-local-only"
export APP_ENV=test RATE_LIMIT_ENABLED=false SECRET_KEY="$SECRET" DATABASE_URL="$DBURL" ESTIMATOR_DB_URL="$DBURL"
export CORS_EXTRA_ORIGINS="http://localhost:$WEB_PORT" PAYMENT_DUE_ENABLED=true CONDUCE_LEDGER_ENABLED=true PHASED_INVOICING_ENABLED=true \
  FISCAL_NCF_ENABLED=true STATUS_HISTORY_ENABLED=true RFQ_ENABLED=true PO_ENABLED=true SUPPLIERS_ENABLED=true \
  ENGINEERING_ESTIMATE_ENABLED=true RECEIPT_ENABLED=true
( cd "$BACKEND_DIR" && exec "$BACKEND_PY" -m uvicorn main:app --port "$API_PORT" >"$WORK/api.log" 2>&1 ) & APIPID=$!
for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$API_PORT/health" && break; sleep 1; done
curl -s -o /dev/null "http://localhost:$API_PORT/health" || { tail -20 "$WORK/api.log"; fail "API did not start"; }

step "3/6 seed"
( cd "$BACKEND_DIR" && GATE_API="http://localhost:$API_PORT" GATE_SEED_OUT="$WORK/seed.json" "$BACKEND_PY" "$FE/scripts/ui-audit/gate-seed.py" ) || fail "seed"

step "4/6 production build (API url points at the local gate API)"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" npx next build >"$WORK/build.log" 2>&1 || { tail -30 "$WORK/build.log"; fail "next build"; }
echo "build ok"
NEXT_PUBLIC_API_URL="http://localhost:$API_PORT" setsid npx next start -p "$WEB_PORT" >"$WORK/web.log" 2>&1 & WEBPID=$!
for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$WEB_PORT/login" && break; sleep 1; done
curl -s -o /dev/null "http://localhost:$WEB_PORT/login" || fail "web did not start"

step "5/6 tap-target audit (360px touch + 1280px mouse)"
J() { node -e "console.log(require('$WORK/seed.json').$1)"; }
export NODE_PATH="$(npm root -g)"
BASE="http://localhost:$WEB_PORT" TOKEN="$(J token)" QID="$(J qid)" PTOKEN="$(J ptoken)" PROJ="$(J proj)" \
  RECEIPT_INVOICE="$(J receipt_invoice)" CONDUCE_INVOICE="$(J conduce_invoice)" \
  node scripts/ui-audit/tap-audit.cjs "$WORK/audit.json" | tail -c 3000
AUDIT_RC=${PIPESTATUS[0]}
echo "audit own exit code: $AUDIT_RC (the audit's own rule, unchanged)"

step "6/6 gate rule (summary check)"
node scripts/ui-audit/gate-check.cjs "$WORK/audit.json" "$AUDIT_RC"
RC=$?
echo "== gate total runtime: $(( $(date +%s) - T0 ))s, exit $RC"
exit $RC
