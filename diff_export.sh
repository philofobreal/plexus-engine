#!/bin/bash

# ------------------------------------------------------------
# diff_export.sh
#
# Rövid leírás:
# Ez a script egy Markdown fájlba exportálja az aktuális branch
# teljes PR diff-jét a megadott base branch-hez képest, beleértve:
# - commitolt változások
# - staged / unstaged módosítások
# - untracked fájlok
# + az érintett fájlok teljes aktuális tartalmát
#
# Telepítés:
# 1. Mentsd el fájlba: diff_export.sh
# 2. Adj futtatási jogot:
#    chmod +x diff_export.sh
# 3. (Opcionális) tedd PATH-ba:
#    mv diff_export.sh ~/bin/  vagy /usr/local/bin/
#
# Használat:
#   ./diff_export.sh [base-branch]
#
# Példák:
#   ./diff_export.sh           # default: main
#   ./diff_export.sh develop
#
# Kimenet:
#   branch_pr_snapshot.md
# ------------------------------------------------------------

set -euo pipefail

BASE_BRANCH="${1:-main}"
OUT="branch_pr_snapshot.md"

cd "$(git rev-parse --show-toplevel)" || exit 1

CURRENT_BRANCH="$(git branch --show-current)"
TMP_OUT="$(mktemp)"

cleanup() {
  rm -f "$TMP_OUT"
}
trap cleanup EXIT

git fetch origin "$BASE_BRANCH" >/dev/null 2>&1 || true

if git rev-parse --verify "origin/$BASE_BRANCH" >/dev/null 2>&1; then
  BASE_REF="origin/$BASE_BRANCH"
elif git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1; then
  BASE_REF="$BASE_BRANCH"
else
  echo "Hiba: nem található base branch: $BASE_BRANCH"
  exit 1
fi

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD)"

{
  echo "# PR snapshot"
  echo
  echo "- Current branch: \`$CURRENT_BRANCH\`"
  echo "- Base branch: \`$BASE_REF\`"
  echo "- Merge base: \`$MERGE_BASE\`"
  echo "- Generated: \`$(date -Iseconds)\`"
  echo

  echo "## Teljes PR diff"
  echo
  echo '```diff'

  # Commitolt + staged + unstaged tracked változások a PR merge-base óta
  git diff "$MERGE_BASE"

  # Untracked fájlok diffként
  while IFS= read -r file; do
    [ "$file" = "$OUT" ] && continue
    [ "$file" = "$(basename "$TMP_OUT")" ] && continue

    git diff --no-index -- /dev/null "$file" || true
  done < <(git ls-files --others --exclude-standard)

  echo '```'
  echo

  echo "## Érintett fájlok teljes aktuális tartalma"
  echo

  while IFS= read -r file; do
    [ "$file" = "$OUT" ] && continue
    [ "$file" = "$(basename "$TMP_OUT")" ] && continue

    echo "### \`$file\`"
    echo

    if [ -f "$file" ]; then
      echo '```'
      cat "$file"
      echo
      echo '```'
    else
      echo "_A fájl törölve lett, ezért nincs aktuális tartalma._"
    fi

    echo
  done < <(
    {
      git diff --name-only "$MERGE_BASE"
      git ls-files --others --exclude-standard
    } | sort -u
  )

} > "$TMP_OUT"

mv "$TMP_OUT" "$OUT"
trap - EXIT

echo "Kész: $OUT"