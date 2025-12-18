# Internal API

## Auth

### POST /api/auth/signup
Auth: Public  
Request:
- full_name: string
- email: string
- password: string

Response 200:
- user: PublicUser

Errors:
- 400 invalid input
- 409 email already in use

Sets cookie:
- np_session (httpOnly)

### POST /api/auth/login
Auth: Public  
Request:
- email: string
- password: string

Response 200:
- user: PublicUser

Errors:
- 400 invalid input
- 401 invalid email or password

Sets cookie:
- np_session (httpOnly)

### POST /api/auth/logout
Auth: Requires cookie  
Response 200:
- ok: true

Clears cookie:
- np_session

## User

### GET /api/me
Auth: Requires cookie  
Response 200:
- user: PublicUser

Errors:
- 401 unauthorized