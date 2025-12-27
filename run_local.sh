#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="notes-polish-mongo"
DB_VOLUME="notes-polish-mongo-data"
HOST_PORT="${MONGO_PORT:-27077}"
IMAGE="mongo:7"

NEXT_PID=""
WORKER_PID=""

seed_if_needed() {
  if [ ! -f ".env.local" ]; then
    echo "Seed skipped: .env.local not found"
    return 0
  fi

  set -a
  source .env.local
  set +a

  node -e '
  const fs = require("fs");
  const { MongoClient } = require("mongodb");
  const { EJSON } = require("bson");

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "note_polish";

  if (!uri) { console.log("Seed skipped: MONGODB_URI not set."); process.exit(0); }

  const seeds = [
    { colName: "style_presets", seedPath: "db/note_polish/style_presets.json" },
    { colName: "users", seedPath: "db/note_polish/users.json" },
  ];

  (async () => {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    for (const s of seeds) {
      if (!fs.existsSync(s.seedPath)) { console.log(`Seed skipped: missing ${s.seedPath}`); continue; }

      const exists = (await db.listCollections({ name: s.colName }, { nameOnly: true }).toArray()).length > 0;
      if (exists) { console.log(`Seed skipped: collection ${dbName}.${s.colName} already exists.`); continue; }

      const docs = EJSON.parse(fs.readFileSync(s.seedPath, "utf8"));
      if (!Array.isArray(docs) || docs.length === 0) { console.log(`Seed skipped: ${s.seedPath} is empty or not a JSON array.`); continue; }

      await db.createCollection(s.colName);
      await db.collection(s.colName).insertMany(docs);
      console.log(`Seeded ${docs.length} docs into ${dbName}.${s.colName}.`);
    }

    await client.close();
  })().catch(e => { console.log("Seed skipped: " + e.message); process.exit(0); });
  '
}

cleanup() {
  echo ""
  echo "Shutting down..."

  # Stop Next
  if [ -n "${NEXT_PID}" ] && kill -0 "${NEXT_PID}" >/dev/null 2>&1; then
    kill "${NEXT_PID}" >/dev/null 2>&1 || true
    echo "Next.js stopped: ${NEXT_PID}"
  fi

  # Stop Worker
  if [ -n "${WORKER_PID}" ] && kill -0 "${WORKER_PID}" >/dev/null 2>&1; then
    kill "${WORKER_PID}" >/dev/null 2>&1 || true
    echo "Worker stopped: ${WORKER_PID}"
  fi

  # Stop Mongo container
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
echo "Starting Worker + Next.js dev server (Ctrl+C to stop)..."

# Start worker in background
npm run worker &
WORKER_PID=$!
echo "Worker started: ${WORKER_PID}"

# Start Next in background too, then wait on it
npm run dev &
NEXT_PID=$!
echo "Next.js started: ${NEXT_PID}"

# Keep script alive until Next exits (Ctrl+C triggers trap)
wait "${NEXT_PID}"