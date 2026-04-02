#!/usr/bin/env bash
# run_tests.sh — One-click test runner for CivicForum Operations Platform
#
# Usage:
#   bash run_tests.sh           # run unit + API tests (starts test containers)
#   bash run_tests.sh --unit    # unit tests only (no Docker required)
#   bash run_tests.sh --api     # API tests only (containers must already be up)
#
# Requirements:
#   - Node.js + npm (for unit tests)
#   - Docker + Docker Compose (for API tests)
#
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Config ───────────────────────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.test.yml"
# Host port for app-test (avoid clashing with unrelated services on 3001)
export TEST_HOST_PORT="${TEST_HOST_PORT:-3011}"
TEST_BASE_URL="${TEST_BASE_URL:-http://localhost:${TEST_HOST_PORT}}"
HEALTH_URL="${TEST_BASE_URL}/api/v1/health"
HEALTH_TIMEOUT=120   # seconds to wait for the app to become healthy
HEALTH_INTERVAL=3    # seconds between health checks

# ─── Argument parsing ─────────────────────────────────────────────────────────
RUN_UNIT=true
RUN_API=true
MANAGED_COMPOSE=false   # whether this script started the containers

for arg in "$@"; do
  case "$arg" in
    --unit) RUN_API=false  ;;
    --api)  RUN_UNIT=false ;;
    *)      echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
section() { echo -e "\n${CYAN}${BOLD}▶ $*${RESET}"; }
ok()      { echo -e "${GREEN}✔  $*${RESET}"; }
fail()    { echo -e "${RED}✖  $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠  $*${RESET}"; }

# Ensure local dev dependencies exist before running host-side jest commands.
ensure_local_test_deps() {
  if [ ! -x "node_modules/.bin/jest" ]; then
    section "Installing local test dependencies (npm ci)"
    npm ci
    ok "Dependencies installed"
  fi
}

# Only treat the port as "our" test server if health JSON matches this app
# (avoids false positives when another stack already listens on the test port).
civicforum_health_ok() {
  local body
  body=$(curl -sf "$HEALTH_URL" 2>/dev/null) || return 1
  echo "$body" | grep -q '"services"' || return 1
  echo "$body" | grep -q '"database"' || return 1
  return 0
}

# ─── Trap: always print summary and optionally tear down ─────────────────────
UNIT_EXIT=0
API_EXIT=0

cleanup() {
  local exit_code=$?
  if $MANAGED_COMPOSE && $RUN_API; then
    section "Stopping test containers"
    docker compose -f "$COMPOSE_FILE" down --volumes --timeout 10 \
      >/dev/null 2>&1 && ok "Containers stopped" || warn "Container stop returned non-zero (ignored)"
  fi

  # ── Final summary ────────────────────────────────────────────────────────
  echo ""
  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  TEST SUMMARY${RESET}"
  echo -e "${BOLD}════════════════════════════════════════${RESET}"

  if $RUN_UNIT; then
    if [ "$UNIT_EXIT" -eq 0 ]; then
      ok "Unit tests    PASSED"
    else
      fail "Unit tests    FAILED  (exit $UNIT_EXIT)"
    fi
  fi

  if $RUN_API; then
    if [ "$API_EXIT" -eq 0 ]; then
      ok "API tests     PASSED"
    else
      fail "API tests     FAILED  (exit $API_EXIT)"
    fi
  fi

  OVERALL=0
  [ "$UNIT_EXIT" -ne 0 ] && OVERALL=1
  [ "$API_EXIT"  -ne 0 ] && OVERALL=1

  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  if [ "$OVERALL" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}  ALL TESTS PASSED${RESET}"
  else
    echo -e "${RED}${BOLD}  SOME TESTS FAILED${RESET}"
  fi
  echo -e "${BOLD}════════════════════════════════════════${RESET}"
  echo ""
  exit "$OVERALL"
}
trap cleanup EXIT

# ─── Unit tests ───────────────────────────────────────────────────────────────
if $RUN_UNIT; then
  ensure_local_test_deps
  section "Running unit tests"
  set +e
  npm run test:unit
  UNIT_EXIT=$?
  set -e
  if [ "$UNIT_EXIT" -eq 0 ]; then
    ok "Unit tests passed"
  else
    fail "Unit tests failed"
  fi
fi

# ─── API tests ────────────────────────────────────────────────────────────────
if $RUN_API; then
  ensure_local_test_deps

  # Start compose unless a real CivicForum health endpoint is already up on TEST_BASE_URL
  if civicforum_health_ok; then
    warn "CivicForum test server already healthy at $TEST_BASE_URL — skipping docker compose up"
  else
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      warn "Something responds on $HEALTH_URL but it is not CivicForum health — starting $COMPOSE_FILE (needs free host port)"
    fi
    section "Starting test containers ($COMPOSE_FILE)"
    if ! docker compose -f "$COMPOSE_FILE" up --build --detach; then
      fail "docker compose up failed — is host port ${TEST_HOST_PORT} already in use? Stop the other service or set TEST_HOST_PORT to a free port."
      API_EXIT=1
      exit 1
    fi
    MANAGED_COMPOSE=true
    ok "Containers started"
  fi

  # Wait for health check
  section "Waiting for application health check (timeout: ${HEALTH_TIMEOUT}s)"
  elapsed=0
  until civicforum_health_ok; do
    if [ "$elapsed" -ge "$HEALTH_TIMEOUT" ]; then
      fail "Application did not become healthy within ${HEALTH_TIMEOUT}s"
      echo ""
      echo "Container logs:"
      docker compose -f "$COMPOSE_FILE" logs --tail=50 app-test 2>/dev/null || true
      API_EXIT=1
      exit 1
    fi
    printf "  waiting... (%ds)\r" "$elapsed"
    sleep "$HEALTH_INTERVAL"
    elapsed=$(( elapsed + HEALTH_INTERVAL ))
  done
  ok "Health check passed (${elapsed}s)"

  # Show health response
  echo ""
  echo "  Health response:"
  curl -sf "$HEALTH_URL" | sed 's/^/    /' || true
  echo ""

  section "Running API tests"
  set +e
  TEST_BASE_URL="$TEST_BASE_URL" npm run test:api
  API_EXIT=$?
  set -e
  if [ "$API_EXIT" -eq 0 ]; then
    ok "API tests passed"
  else
    fail "API tests failed"
  fi
fi
