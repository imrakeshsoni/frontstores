#!/usr/bin/env bash
# FrontStores one-command release.
#
#   bash tools/release.sh            # auto patch bump (1.4.9 -> 1.4.10)
#   bash tools/release.sh 1.5.0      # explicit version
#
# Guards against the mistakes that have bitten us before:
#   - refuses to release from anything other than `main` (no stale backup-branch releases)
#   - refuses if the working tree still has uncommitted changes (commit your work first)
#   - runs tsc + vitest and aborts on failure (matches the CI gate)
# Then: bumps src-tauri/tauri.conf.json, commits, tags vX.Y.Z, pushes main + tag.
# GitHub Actions builds the installers and canary-publishes as a pre-release.
set -euo pipefail
cd "$(dirname "$0")/.."

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  echo "✗ On '$branch'. Releases must come from 'main'. Aborting." >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Working tree has uncommitted changes. Commit your feature work first, then release." >&2
  git status --short >&2
  exit 1
fi

conf="src-tauri/tauri.conf.json"
current=$(grep -m1 '"version"' "$conf" | sed -E 's/.*"version": *"([^"]+)".*/\1/')

if [ "${1:-}" != "" ]; then
  next="$1"
else
  IFS='.' read -r major minor patch <<< "$current"
  next="$major.$minor.$((patch + 1))"
fi
echo "→ Releasing $current → $next from main"

echo "→ Typecheck…"; npx tsc --noEmit
echo "→ Tests…";     npx vitest run

# bump version (macOS/BSD sed)
sed -i '' -E "s/(\"version\": *\")$current(\")/\1$next\2/" "$conf"

git add "$conf"
git commit -q -m "chore: release v$next [core] [all apps] [all tenants]

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git tag "v$next"
git push origin main
git push origin "v$next"

echo "✓ v$next pushed. GitHub Actions is building + canary-publishing."
echo "  Watch: gh run list --limit 3   |   Promote to all tenants when ready."
