#!/usr/bin/env bash
set -euo pipefail

# Deletes all local Docker resources created by this project:
# - MongoDB container
# - MongoDB named volume (THIS DELETES ALL LOCAL DB DATA)
#
# Usage:
#   bash ./clean.sh

DB_CONTAINER="notes-polish-mongo"
DB_VOLUME="notes-polish-mongo-data"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Nothing to clean."
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi

echo "Cleaning project Docker resources..."

# Stop + remove container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    docker stop "${DB_CONTAINER}" >/dev/null || true
    echo "Stopped container: ${DB_CONTAINER}"
  fi

  docker rm "${DB_CONTAINER}" >/dev/null || true
  echo "Removed container: ${DB_CONTAINER}"
else
  echo "Container not found: ${DB_CONTAINER}"
fi

# Remove volume if it exists (deletes DB data)
if docker volume ls --format '{{.Name}}' | grep -q "^${DB_VOLUME}$"; then
  docker volume rm "${DB_VOLUME}" >/dev/null || true
  echo "Removed volume: ${DB_VOLUME}"
else
  echo "Volume not found: ${DB_VOLUME}"
fi

echo "Done."