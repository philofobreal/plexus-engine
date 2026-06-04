#!/usr/bin/env bash

# Pelda:
#   USE_GIT=1 ./export-source.sh . plexus-source-export.md
#   ./export-source.sh . source-export.md
set -euo pipefail

ROOT="${1:-.}"
OUTPUT="${2:-source-export.md}"
USE_GIT="${USE_GIT:-0}"

INCLUDE_REGEX='\.(ts|tsx|js|jsx|css|scss|html|json|md|svg|ps1|sh|yml|yaml)$'
EXCLUDE_DIR_REGEX='(^|/)(node_modules|dist|build|\.git|\.vite|\.cache|coverage)(/|$)'
EXCLUDE_FILE_REGEX='(^|/)(package-lock\.json|bun\.lock|vite-dev\.log|vite-dev\.err\.log|vite-smoke\.out\.log|vite-smoke\.err\.log)$'

cd "$ROOT"

if [[ "$USE_GIT" == "1" ]]; then
  mapfile -t FILES < <(
    git ls-files \
      | grep -E "$INCLUDE_REGEX" \
      | grep -Ev "$EXCLUDE_DIR_REGEX" \
      | grep -Ev "$EXCLUDE_FILE_REGEX" \
      | sort || true
  )
else
  mapfile -t FILES < <(
    find . -type f \
      | sed 's#^\./##' \
      | grep -E "$INCLUDE_REGEX" \
      | grep -Ev "$EXCLUDE_DIR_REGEX" \
      | grep -Ev "$EXCLUDE_FILE_REGEX" \
      | sort || true
  )
fi

count_files=0
total_lines=0
total_bytes=0

ts_files=0
ts_lines=0
ts_bytes=0

js_files=0
js_lines=0
js_bytes=0

doc_files=0
doc_lines=0
doc_bytes=0

other_files=0
other_lines=0
other_bytes=0

file_line_count() {
  local file="$1"
  wc -l < "$file" | tr -d '[:space:]'
}

file_byte_count() {
  local file="$1"
  wc -c < "$file" | tr -d '[:space:]'
}

kb_from_bytes() {
  local bytes="$1"
  awk -v b="$bytes" 'BEGIN { printf "%.1f", b / 1024 }'
}

category_for_file() {
  local file="$1"
  case "$file" in
    *.ts|*.tsx)
      echo "TypeScript"
      ;;
    *.js|*.jsx)
      echo "JavaScript"
      ;;
    *.md|documents/*|docs/*)
      echo "Dokumentacio"
      ;;
    *)
      echo "Egyeb"
      ;;
  esac
}

add_stats() {
  local category="$1"
  local lines="$2"
  local bytes="$3"

  count_files=$((count_files + 1))
  total_lines=$((total_lines + lines))
  total_bytes=$((total_bytes + bytes))

  case "$category" in
    "TypeScript")
      ts_files=$((ts_files + 1))
      ts_lines=$((ts_lines + lines))
      ts_bytes=$((ts_bytes + bytes))
      ;;
    "JavaScript")
      js_files=$((js_files + 1))
      js_lines=$((js_lines + lines))
      js_bytes=$((js_bytes + bytes))
      ;;
    "Dokumentacio")
      doc_files=$((doc_files + 1))
      doc_lines=$((doc_lines + lines))
      doc_bytes=$((doc_bytes + bytes))
      ;;
    *)
      other_files=$((other_files + 1))
      other_lines=$((other_lines + lines))
      other_bytes=$((other_bytes + bytes))
      ;;
  esac
}

print_console_row() {
  local label="$1"
  local files="$2"
  local lines="$3"
  local bytes="$4"
  local kb
  kb="$(kb_from_bytes "$bytes")"
  printf "  %-15s %7d fajl %10d sor %10s KB\n" "$label" "$files" "$lines" "$kb"
}

for file in "${FILES[@]}"; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$file" ]] && continue

  lines="$(file_line_count "$file")"
  bytes="$(file_byte_count "$file")"
  category="$(category_for_file "$file")"
  add_stats "$category" "$lines" "$bytes"
done

{
  echo "# Source Export"
  echo
  echo "Root: $(pwd)"
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Use Git: $USE_GIT"
  echo
  echo "## Osszesites"
  echo
  echo "| Kategoria | Fajlok | Sorok | Meret (KB) |"
  echo "|---|---:|---:|---:|"
  echo "| TypeScript | $ts_files | $ts_lines | $(kb_from_bytes "$ts_bytes") |"
  echo "| JavaScript | $js_files | $js_lines | $(kb_from_bytes "$js_bytes") |"
  echo "| Dokumentacio | $doc_files | $doc_lines | $(kb_from_bytes "$doc_bytes") |"
  echo "| Egyeb | $other_files | $other_lines | $(kb_from_bytes "$other_bytes") |"
  echo "| Osszesen | $count_files | $total_lines | $(kb_from_bytes "$total_bytes") |"
  echo
  echo "## Projektstruktura"
  echo
} > "$OUTPUT"

for file in "${FILES[@]}"; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$file" ]] && continue

  lines="$(file_line_count "$file")"
  bytes="$(file_byte_count "$file")"
  category="$(category_for_file "$file")"
  kb="$(kb_from_bytes "$bytes")"
  echo "- $file ($category, $lines sor, $kb KB)" >> "$OUTPUT"
done

for file in "${FILES[@]}"; do
  [[ -z "$file" ]] && continue
  [[ ! -f "$file" ]] && continue

  ext="${file##*.}"
  lines="$(file_line_count "$file")"
  bytes="$(file_byte_count "$file")"
  category="$(category_for_file "$file")"
  kb="$(kb_from_bytes "$bytes")"

  {
    echo
    echo "---"
    echo
    echo "## $file"
    echo
    echo "- Kategoria: $category"
    echo "- Sorok: $lines"
    echo "- Meret: $kb KB"
    echo
    echo '```'"$ext"
    cat "$file"
    echo
    echo '```'
  } >> "$OUTPUT"
done

output_path="$(pwd)/$OUTPUT"

echo
echo "============================================================"
echo " Source export kesz"
echo "============================================================"
echo " Gyoker:  $(pwd)"
echo " Kimenet: $output_path"
echo " Mod:     $([[ "$USE_GIT" == "1" ]] && echo "git ls-files" || echo "find")"
echo
echo " Osszesites:"
print_console_row "TypeScript" "$ts_files" "$ts_lines" "$ts_bytes"
print_console_row "JavaScript" "$js_files" "$js_lines" "$js_bytes"
print_console_row "Dokumentacio" "$doc_files" "$doc_lines" "$doc_bytes"
print_console_row "Egyeb" "$other_files" "$other_lines" "$other_bytes"
echo " ------------------------------------------------------------"
print_console_row "Osszesen" "$count_files" "$total_lines" "$total_bytes"
echo "============================================================"
echo
