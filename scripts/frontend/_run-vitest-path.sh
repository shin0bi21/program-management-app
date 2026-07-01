#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <label> <frontend-path>" >&2
  exit 1
fi

LABEL="$1"
TARGET="$2"

echo ""
echo "Running ${LABEL} frontend tests..."
echo "------------------------------------------"

if ! find "frontend/$TARGET" \( -name '*.test.ts' -o -name '*.test.tsx' \) -print -quit 2>/dev/null | grep -q .; then
  echo ""
  echo "No ${LABEL} frontend tests found under frontend/${TARGET}. Skipping."
  exit 0
fi

if (cd frontend && npm test -- "$TARGET"); then
  echo ""
  echo "${LABEL} frontend tests passed!"
else
  echo ""
  echo "${LABEL} frontend tests failed! See output above."
  exit 1
fi
