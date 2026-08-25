#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

validation_failed=0
skill_count=0
skills_root="./skills"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  validation_failed=1
}

while IFS= read -r symlink; do
  fail "symlinks are not allowed: ${symlink#./}"
done < <(find . -path ./.git -prune -o -type l -print)

if [[ ! -d "$skills_root" ]]; then
  fail "repository must contain a skills/ directory"
fi

while IFS= read -r shared_file; do
  fail "files directly under skills/ are not allowed: ${shared_file#./}"
done < <(find "$skills_root" -mindepth 1 -maxdepth 1 -type f ! -name '.gitkeep' -print)

while IFS= read -r -d '' skill_dir; do
  skill_name="$(basename "$skill_dir")"
  skill_file="$skill_dir/SKILL.md"
  skill_count=$((skill_count + 1))

  if [[ ! "$skill_name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    fail "skill directory must use lowercase kebab-case: $skill_name"
  fi

  if [[ ! -f "$skill_file" ]]; then
    fail "$skill_name must contain SKILL.md"
    continue
  fi

  if [[ "$(sed -n '1p' "$skill_file")" != "---" ]]; then
    fail "$skill_file must begin with YAML frontmatter"
  elif ! awk 'NR > 1 && NR <= 50 && $0 == "---" { found = 1; exit } END { exit(found ? 0 : 1) }' "$skill_file"; then
    fail "$skill_file must close its YAML frontmatter within 50 lines"
  fi

  frontmatter_name="$({ sed -n '2,/^---$/p' "$skill_file" || true; } | sed -nE 's/^name:[[:space:]]*([a-z0-9]+(-[a-z0-9]+)*)[[:space:]]*$/\1/p' | head -n 1)"
  if [[ "$frontmatter_name" != "$skill_name" ]]; then
    fail "$skill_file name must be unquoted and exactly match '$skill_name'"
  fi

  if ! sed -n '2,/^---$/p' "$skill_file" | grep -Eq '^description:[[:space:]]*[^[:space:]].*$'; then
    fail "$skill_file must have a non-empty description"
  fi

  if ! grep -Fq "(skills/$skill_name/)" README.md; then
    fail "$skill_name must be linked in the README Available skills table"
  fi

  while IFS= read -r large_file; do
    fail "files larger than 5 MiB are not allowed: ${large_file#./}"
  done < <(find "$skill_dir" -type f -size +5M -print)

  while IFS= read -r opaque_file; do
    fail "compiled or archived files are not allowed: ${opaque_file#./}"
  done < <(
    find "$skill_dir" -type f \( \
      -iname '*.7z' -o -iname '*.a' -o -iname '*.class' -o \
      -iname '*.dll' -o -iname '*.dylib' -o -iname '*.exe' -o \
      -iname '*.gz' -o -iname '*.jar' -o -iname '*.o' -o \
      -iname '*.pyc' -o -iname '*.so' -o -iname '*.tar' -o \
      -iname '*.tgz' -o -iname '*.wasm' -o -iname '*.zip' \
    \) -print
  )

  while IFS= read -r secret_file; do
    fail "credential files are not allowed: ${secret_file#./}"
  done < <(
    find "$skill_dir" -type f \( \
      -name '.env' -o -name 'id_dsa' -o -name 'id_ed25519' -o \
      -name 'id_rsa' -o -iname '*.key' -o -iname '*.p12' -o \
      -iname '*.pem' -o -iname '*.pfx' \
    \) -print
  )
done < <(find "$skills_root" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -print0)

if (( skill_count == 0 )); then
  printf 'No skills found yet; repository-level files are valid.\n'
fi

if (( validation_failed != 0 )); then
  exit 1
fi

printf 'Validated %d skill(s).\n' "$skill_count"
