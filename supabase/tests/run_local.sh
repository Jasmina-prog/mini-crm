#!/usr/bin/env bash
# Прогон проверок безопасности на локальном Postgres (без Supabase).
# Использование: PGURL=postgres://postgres@127.0.0.1:5432/postgres ./supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
PGURL="${PGURL:-postgres://postgres@127.0.0.1:5432/postgres}"
DB=crm_security_test
psql "$PGURL" -qc "drop database if exists $DB" -c "create database $DB"
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
psql "$TEST_URL" -v ON_ERROR_STOP=0 -f supabase/tests/security_test.sql
