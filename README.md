# NestJS Article Service

RESTful API built with NestJS providing JWT authentication, article management, PostgreSQL persistence, and Redis-backed caching.

## Prerequisites

- Node.js 18+
- PostgreSQL database (accessible via `DATABASE_URL`)
- Redis instance for caching (optional, but required for cache features)

## Installation

```bash
npm install
```

Copy environment template and adjust values as needed:

```bash
cp .env.example .env
```

## Local PostgreSQL with Docker

If you prefer not to manage PostgreSQL manually, use the provided scripts (Docker required):

```bash
# start the database container
npm run db:up

# stop and remove the container when finished
npm run db:down
```

The container exposes PostgreSQL on `localhost:5432` with credentials matching `.env.example`.

## Database

Run migrations before starting the application:

```bash
npm run migration:run
```

To revert or inspect migrations:

```bash
npm run migration:revert
npm run migration:show
```

## Development

Start the API in watch mode:

```bash
npm run start:dev
```

The Swagger UI is available at `http://localhost:3000/api/docs` (port configurable through `PORT`).

## Testing

Execute the Vitest suite:

```bash
npm run test
```

## Example Requests

Register a user:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ChangeMe123","name":"Example User"}'
```

Authenticate and fetch the current profile:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"ChangeMe123"}'

curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

Create an article:

```bash
curl -X POST http://localhost:3000/articles \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Article","description":"Short summary"}'
```

List articles with filters:

```bash
curl "http://localhost:3000/articles?page=1&limit=5&search=nestjs"
```
