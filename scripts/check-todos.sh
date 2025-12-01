#!/bin/bash

# Check for TODO/FIXME comments in staged files
# Warns but doesn't block commits

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

WARNINGS=0

for FILE in $STAGED_FILES; do
  # Check for TODO, FIXME, XXX, HACK, BUG comments (case insensitive)
  if git diff --cached "$FILE" | grep -iE '^\+.*(TODO|FIXME|XXX|HACK|BUG)' > /dev/null; then
    echo "⚠️  Warning: TODO/FIXME comment found in $FILE"
    git diff --cached "$FILE" | grep -iE '^\+.*(TODO|FIXME|XXX|HACK|BUG)' | sed 's/^/  /'
    WARNINGS=$((WARNINGS + 1))
  fi
done

if [ $WARNINGS -gt 0 ]; then
  echo ""
  echo "Found $WARNINGS file(s) with TODO/FIXME comments (warning only)."
fi

exit 0

