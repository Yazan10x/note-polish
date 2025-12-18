#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="notes-polish-mongo"
DB_VOLUME="notes-polish-mongo-data"
HOST_PORT="${MONGO_PORT:-27077}"
IMAGE="mongo:7"

seed_if_needed() {
  # Requires .env.local with MONGODB_URI
  if [ ! -f ".env.local" ]; then
    echo "Seed skipped: .env.local not found"
    return 0
  fi

  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a

  node -e '
  const fs = require("fs");
  const { MongoClient } = require("mongodb");
  const { EJSON } = require("bson");

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "note_polish";
  const colName = "style_presets";
  const seedPath = "db/note_polish/style_presets.json";

  if (!uri) { console.log("Seed skipped: MONGODB_URI not set."); process.exit(0); }
  if (!fs.existsSync(seedPath)) { console.log(`Seed skipped: missing ${seedPath}`); process.exit(0); }

  (async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    // Your new logic: since we only call this on fresh container creation,
    // we can just insert. Still keep a safety check.
    const exists = (await db.listCollections({ name: colName }, { nameOnly: true }).toArray()).length > 0;
    if (exists) { console.log(`Seed skipped: collection ${dbName}.${colName} already exists.`); await client.close(); return; }

    const docs = EJSON.parse(fs.readFileSync(seedPath, "utf8"));
    if (!Array.isArray(docs) || docs.length === 0) { console.log("Seed skipped: seed file is empty."); await client.close(); return; }

    await db.createCollection(colName);
    await db.collection(colName).insertMany(docs);
    console.log(`Seeded ${docs.length} docs into ${dbName}.${colName}.`);
    await client.close();
  })().catch(e => { console.log("Seed skipped: " + e.message); process.exit(0); });
  '
}

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

  created_new_container="false"

  if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
      echo "MongoDB container already running: ${DB_CONTAINER}"
    else
      echo "Starting existing container: ${DB_CONTAINER}"
      docker start "${DB_CONTAINER}" >/dev/null
    fi
  else
    created_new_container="true"
    docker run -d \
      --name "${DB_CONTAINER}" \
      -p "${HOST_PORT}:27017" \
      -v "${DB_VOLUME}:/data/db" \
      "${IMAGE}" >/dev/null
    echo "Created MongoDB container: ${DB_CONTAINER}"
  fi

  echo "MongoDB ready."

  if [ "${created_new_container}" = "true" ]; then
    echo "Seeding DB (first run only)..."
    seed_if_needed
  fi
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