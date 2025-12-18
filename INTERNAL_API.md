# Internal API

Cookie auth
- Cookie name: `np_session`
- httpOnly, sameSite=lax, secure in production, path=/, maxAge=30 days
- All “Requires cookie” routes return 401 if missing or invalid

---

## Auth

### POST /api/auth/signup
Auth: Public

Request JSON
- full_name: string
- email: string
- password: string

Response 200
- user: PublicUser

Errors
- 400 Invalid input
- 409 Email already in use

Side effects
- Creates user
- Creates session
- Sets `np_session` cookie

---

### POST /api/auth/login
Auth: Public

Request JSON
- email: string
- password: string

Response 200
- user: PublicUser

Errors
- 400 Invalid input
- 401 Invalid email or password

Side effects
- Creates session
- Sets `np_session` cookie

---

### POST /api/auth/logout
Auth: Requires cookie

Response 200
- ok: true

Side effects
- Deletes session
- Clears `np_session` cookie

---

## User

### GET /api/me
Auth: Requires cookie

Response 200
- user: PublicUser

Errors
- 401 Unauthorized

---

## Dashboard

### GET /api/dashboard
Auth: Requires cookie

Query params
- days: number (optional, default 7)

Response 200
- period_days: number
- metrics:
    - generations_last_period: number
    - downloads_last_period: number
    - favourites_total: number
    - active_styles: number
- recent_generations: Array (max 4)
    - id: string
    - title: string
    - style_label: string
    - status: "pending" | "processing" | "processed" | "failed"
    - created_at: string (ISO)
- quick_actions:
    - key: "open_playground" | "view_history"
    - title: string
    - href: string

Errors
- 401 Unauthorized

---

## Style Presets

### GET /api/style-presets
Auth: Requires cookie (recommended)

Response 200
- presets: PublicStylePreset[]

Errors
- 401 Unauthorized (if enforced)

Notes
- PublicStylePreset intentionally excludes `prompt`

---

## Generations

### POST /api/generations/pending
Auth: Requires cookie

Behavior
- If user already has a `pending` generation, returns it
- Otherwise creates a new `pending` generation using the first active preset by `sort_order`

Response 200
- generation: PublicNoteGeneration

Errors
- 401 Unauthorized
- 500 No active style presets found (if none exist)

Notes
- PublicNoteGeneration hides `snapshot_prompt`
- `input_files` and `output_files` are URLs (presigned S3 or internal `/files/:key` route)