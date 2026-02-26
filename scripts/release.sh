#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/release.sh \"commit message\""
  exit 1
fi

commit_message="$*"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository."
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  echo "No staged changes. Nothing to commit."
  exit 0
fi

git commit -m "${commit_message}"

branch_name="$(git rev-parse --abbrev-ref HEAD)"
if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
  echo "Commit created, but upstream is not configured."
  echo "Run once: git push -u origin ${branch_name}"
  exit 2
fi

git push
echo "Done: pushed branch ${branch_name}."
