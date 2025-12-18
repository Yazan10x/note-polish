# Note App Internal API

This document describes the internal HTTP API used by the web app.

## Conventions

### Base
- All routes are under `/api/*` unless explicitly noted.

### Authentication
Cookie session auth
- Cookie name: `np_session`
- Cookie attributes:
  - `httpOnly`
  - `sameSite=lax`
  - `secure=true` in production
  - `path=/`
  - `maxAge=30 days`
- Any route marked “Requires cookie” returns `401` if the cookie is missing or invalid.

### Response shapes
- Success responses are JSON.
- Error responses are JSON:
  - `{ "error": string }`

### Public models
- `PublicUser`: safe user shape returned to the client.
- `PublicStylePreset`: excludes the preset `prompt` by design.
- `PublicNoteGeneration`: excludes sensitive fields such as `snapshot_prompt`.

---

## Auth

### POST `/api/auth/signup`
Auth: Public

Request JSON
- `full_name`: string
- `email`: string
- `password`: string

Response `200`
- `user`: PublicUser

Errors
- `400` Invalid input
- `409` Email already in use

Side effects
- Creates user
- Creates session
- Sets `np_session` cookie

---

### POST `/api/auth/login`
Auth: Public

Request JSON
- `email`: string
- `password`: string

Response `200`
- `user`: PublicUser

Errors
- `400` Invalid input
- `401` Invalid email or password

Side effects
- Creates session
- Sets `np_session` cookie

---

### POST `/api/auth/logout`
Auth: Requires cookie

Response `200`
- `ok`: true

Errors
- `401` Unauthorized

Side effects
- Deletes session
- Clears `np_session` cookie

---

## User

### GET `/api/me`
Auth: Requires cookie

Response `200`
- `user`: PublicUser

Errors
- `401` Unauthorized

---

## Dashboard

### GET `/api/dashboard`
Auth: Requires cookie

Query params
- `days`: number (optional, default `7`)

Response `200`
- `period_days`: number
- `metrics`:
  - `generations_last_period`: number
  - `downloads_last_period`: number
  - `favourites_total`: number
  - `active_styles`: number
- `recent_generations`: array (max 4)
  - `id`: string
  - `title`: string
  - `style_label`: string
  - `status`: "pending" | "queued" | "processing" | "processed" | "failed";
  - `created_at`: string (ISO)
- `quick_actions`: array
  - `key`: `"open_playground" | "view_history"`
  - `title`: string
  - `href`: string

Errors
- `401` Unauthorized

---

## Style Presets

### GET `/api/style-presets`
Auth: Requires cookie (recommended)

Response `200`
- `presets`: PublicStylePreset[]

Errors
- `401` Unauthorized (if enforced)

Notes
- `PublicStylePreset` intentionally excludes `prompt`.

---

## Generations

### POST `/api/generations/pending`
Auth: Requires cookie

Behavior
- If the user already has a `pending` generation, returns it.
- Otherwise creates a new `pending` generation using the first active preset by `sort_order`.

Response `200`
- `generation`: PublicNoteGeneration

Errors
- `401` Unauthorized
- `500` No active style presets found (if none exist)

Notes
- `PublicNoteGeneration` hides `snapshot_prompt`.
- `input_files` and `output_files` are returned as public URLs:
  - Presigned S3 URLs when backed by S3
  - Or an internal `/files/:key` URL when backed by MongoDB/local storage