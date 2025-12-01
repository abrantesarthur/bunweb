#!/bin/bash

# Check for console statements in staged files
# Exits with code 1 if console statements are found

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

VIOLATIONS=0

for FILE in $STAGED_FILES; do
  # Check for console.log, console.error, console.warn, console.debug, console.info
  if git diff --cached "$FILE" | grep -E '^\+.*console\.(log|error|warn|debug|info)' > /dev/null; then
    echo "❌ Error: Console statement found in $FILE"
    git diff --cached "$FILE" | grep -E '^\+.*console\.(log|error|warn|debug|info)' | sed 's/^/  /'
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "Found $VIOLATIONS file(s) with console statements."
  echo "Please remove all console statements before committing."
  exit 1
fi

exit 0

