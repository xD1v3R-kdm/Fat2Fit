#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
repo="https://github.com/xD1v3R-kdm/Fat2Fit.git"
# The publisher needs a GitHub credential already configured on this computer.
# Never paste a personal access token into this file or command line.
if ! command -v git >/dev/null; then
  echo 'Install git first (xcode-select --install on macOS).'
  exit 1
fi
if [[ -f .env.local || -f .env ]]; then
  echo 'Note: local .env files are present, but will be ignored by Git.'
fi
if [[ ! -d .git ]]; then
  git init -b main
fi
git branch -M main
if git remote get-url origin >/dev/null 2>&1; then
  existing="$(git remote get-url origin)"
  if [[ "$existing" != "$repo" && "$existing" != "git@github.com:xD1v3R-kdm/Fat2Fit.git" ]]; then
    echo "Refusing to change existing remote: $existing"
    exit 1
  fi
else
  git remote add origin "$repo"
fi
# Index only tracked application sources, respecting .gitignore.
git add -A
if git diff --cached --name-only | grep -E '(^|/)(\.env(\..*)?|.*\.(pem|key|p12))$' | grep -v '\.env\.example$'; then
  echo 'A secrets-like file was staged; refusing to commit.'
  exit 1
fi
if ! git diff --cached --quiet; then
  git commit -m 'Fat2Fit 0.4 coach-assisted sets and technique video review'
fi
echo "Pushing to $repo (no force push)."
git push -u origin main
