#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash ./setup_local.sh
#   bash ./setup_local.sh sk-your-openai-key
#   OPENAI_API_KEY=sk-your-openai-key bash ./setup_local.sh

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
else
  echo ".env.local already exists, leaving it as-is"
fi

KEY="${1:-${OPENAI_API_KEY:-}}"

if [ -n "${KEY}" ]; then
  tmpfile="$(mktemp)"
  sed "s|^OPENAI_API_KEY=.*$|OPENAI_API_KEY=${KEY}|" .env.local > "${tmpfile}"
  mv "${tmpfile}" .env.local
  echo "Set OPENAI_API_KEY in .env.local"
else
  echo "OPENAI_API_KEY not provided. Edit .env.local when ready."
fi

npm install