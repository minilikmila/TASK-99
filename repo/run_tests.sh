#!/usr/bin/env bash
# run_tests.sh — Fully containerized test runner for CivicForum Operations Platform
#
# All tests execute inside Docker — no host-side Node.js, npm, or jest required.
#
# Usage:
#   bash run_tests.sh           # run unit + API tests
#   bash run_tests.sh --unit    # unit tests only (no DB required)
#   bash run_tests.sh --api     # API tests only (starts DB + app)
#
# Requirements:
#   - Docker + Docker Compose
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
COMPOSE_PROJECT="civicforum-test"

# ─── Argument parsing ─────────────────────────────────────────────────────────
RUN_UNIT=true
RUN_API=true

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

# ─── Trap: always tear down and print summary ────────────────────────────────
UNIT_EXIT=0
API_EXIT=0

cleanup() {
  section "Stopping containers"
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" --profile test down --volumes --timeout 10 \
    >/dev/null 2>&1 && ok "Containers stopped" || warn "Container stop returned non-zero (ignored)"

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

# ─── Build ────────────────────────────────────────────────────────────────────
section "Building test images"
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" --profile test build
ok "Images built"

# ─── Unit tests (containerized, no DB) ───────────────────────────────────────
if $RUN_UNIT; then
  section "Running unit tests (containerized)"
  set +e
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" run --rm --no-deps --entrypoint "" test-runner \
    npx jest --testPathPattern=unit_tests --verbose --forceExit
  UNIT_EXIT=$?
  set -e
  if [ "$UNIT_EXIT" -eq 0 ]; then
    ok "Unit tests passed"
  else
    fail "Unit tests failed"
  fi
fi

# ─── API tests (containerized, starts DB + app) ──────────────────────────────
if $RUN_API; then
  section "Running API tests (containerized — starting DB + app)"
  # docker compose run honours depends_on conditions: it starts db-test and
  # app-test, waits for their health checks, then executes the test command.
  set +e
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" run --rm --entrypoint "" test-runner \
    npx jest --testPathPattern=API_tests --verbose --forceExit --runInBand
  API_EXIT=$?
  set -e
  if [ "$API_EXIT" -eq 0 ]; then
    ok "API tests passed"
  else
    fail "API tests failed"
  fi
fi
