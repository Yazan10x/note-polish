#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="note-polish-mongo"
DB_VOLUME="note-polish-mongo-data"
HOST_PORT="${MONGO_PORT:-27077}"
IMAGE="mongo:7"

cleanup() {
  echo ""
  echo "Shutting down..."

  if command -v docker >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
      docker stop "${DB_CONTAINER}" >/dev/null || true
      echo "MongoDB stopped: ${DB_CONTAINER}"
    fi
  fi
}

trap cleanup INT TERM EXIT

docker_ok() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1 || return 1
  return 0
}

if docker_ok; then
  echo "Docker detected. Starting MongoDB on localhost:${HOST_PORT} ..."
  echo "Using volume: ${DB_VOLUME} (data persists even if the container is deleted)"

  # Ensure the volume exists (safe to call repeatedly).
  if ! docker volume ls --format '{{.Name}}' | grep -q "^${DB_VOLUME}$"; then
    docker volume create "${DB_VOLUME}" >/dev/null
  fi

  if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
      echo "MongoDB container already running: ${DB_CONTAINER}"
    else
      echo "Starting existing container: ${DB_CONTAINER}"
      docker start "${DB_CONTAINER}" >/dev/null
    fi
  else
    docker run -d \
      --name "${DB_CONTAINER}" \
      -p "${HOST_PORT}:27017" \
      -v "${DB_VOLUME}:/data/db" \
      "${IMAGE}" >/dev/null
  fi

  echo "MongoDB ready."
else
  echo "Docker isn't available (not installed or not running)."
  echo "Next.js will still start, but you need a MongoDB URI in .env.local (Atlas or your own local Mongo)."
  echo ""
  echo "Local Mongo via Docker:"
  echo "  Install and open Docker Desktop, then re-run: ./run_local.sh"
fi

echo ""
echo "Starting Next.js dev server (Ctrl+C to stop)..."
npm run dev
