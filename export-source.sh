#!/usr/bin/env bash

# USE_GIT=1 ./export-source.sh . plexus-source-export.md
set -euo pipefail

ROOT="${1:-.}"
OUTPUT="${2:-source-export.md}"
USE_GIT="${USE_GIT:-0}"

INCLUDE_REGEX='\.(ts|tsx|js|jsx|css|scss|html|json|md|svg|ps1|sh|yml|yaml)$'
EXCLUDE_DIR_REGEX='(^|/)(node_modules|dist|build|\.git|\.vite|\.cache|coverage)(/|$)'
EXCLUDE_FILE_REGEX='(^|/)(package-lock\.json|bun\.lock|vite-dev\.log|vite-dev\.err\.log|vite-smoke\.out\.log|vite-smoke\.err\.log)$'

cd "$ROOT"

{
  echo "# Source Export"
  echo
  echo "Root: $(pwd)"
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "## Project Structure"
  echo
} > "$OUTPUT"

if [[ "$USE_GIT" == "1" ]]; then
  FILES=$(git ls-files \
    | grep -E "$INCLUDE_REGEX" \
    | grep -Ev "$EXCLUDE_DIR_REGEX" \
    | grep -Ev "$EXCLUDE_FILE_REGEX" \
    | sort)
else
  FILES=$(find . -type f \
    | sed 's#^\./##' \
    | grep -E "$INCLUDE_REGEX" \
    | grep -Ev "$EXCLUDE_DIR_REGEX" \
    | grep -Ev "$EXCLUDE_FILE_REGEX" \
    | sort)
fi

echo "$FILES" | while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  echo "- $file" >> "$OUTPUT"
done

echo "$FILES" | while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  ext="${file##*.}"

  {
    echo
    echo "---"
    echo
    echo "## $file"
    echo
    echo '```'"$ext"
    cat "$file"
    echo
    echo '```'
  } >> "$OUTPUT"
done

echo "Kész: $(pwd)/$OUTPUT"
echo "Fájlok száma: $(echo "$FILES" | grep -c . || true)"