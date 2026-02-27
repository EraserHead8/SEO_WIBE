#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/release.sh [--tag vX.Y.Z] \"commit message\""
  exit 1
fi

tag_name=""
commit_parts=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      shift
      if [[ $# -eq 0 ]]; then
        echo "Error: --tag requires a value (example: v0.1.3)."
        exit 1
      fi
      tag_name="$1"
      shift
      ;;
    *)
      commit_parts+=("$1")
      shift
      ;;
  esac
done

if [[ ${#commit_parts[@]} -eq 0 ]]; then
  echo "Error: commit message is required."
  echo "Usage: scripts/release.sh [--tag vX.Y.Z] \"commit message\""
  exit 1
fi

commit_message="${commit_parts[*]}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository."
  exit 1
fi

git add -A
created_commit="0"

if git diff --cached --quiet; then
  if [[ -z "${tag_name}" ]]; then
    echo "No staged changes. Nothing to commit."
    exit 0
  fi
  echo "No staged changes. Will create tag on current HEAD."
else
  git commit -m "${commit_message}"
  created_commit="1"
fi

if [[ "${created_commit}" == "1" ]]; then
  branch_name="$(git rev-parse --abbrev-ref HEAD)"
  if ! git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >/dev/null 2>&1; then
    echo "Commit created, but upstream is not configured."
    echo "Run once: git push -u origin ${branch_name}"
    exit 2
  fi
  git push
  echo "Done: pushed branch ${branch_name}."
fi

if [[ -n "${tag_name}" ]]; then
  if git rev-parse "${tag_name}" >/dev/null 2>&1; then
    echo "Tag ${tag_name} already exists locally."
    exit 3
  fi
  if git ls-remote --tags origin "${tag_name}" | grep -q "${tag_name}$"; then
    echo "Tag ${tag_name} already exists on origin."
    exit 3
  fi
  git tag -a "${tag_name}" -m "release ${tag_name}"
  git push origin "${tag_name}"
  echo "Done: pushed tag ${tag_name}."
fi
