# Localink – Real-time Local Services Platform

**Zero-budget MVP** for home services (plumber, electrician, AC repair, etc.).

Customers request a service → nearby online providers are notified → one accepts → both chat + track status → review.

Built with:
- **Backend**: Node.js + Express + TypeScript + Socket.IO + MySQL 8 + Redis
- **Frontend**: (Next.js scaffold ready – see below)
- **Infra**: Docker Compose (MySQL + Redis) – completely free locally

---

## Project Structure

```
localink/
├── schema.sql                 # Full MySQL schema + seed data
├── docker-compose.yml         # MySQL 8 + Redis 7
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── config/            # DB, Redis, app config
│       ├── controllers/       # Auth, Providers, Bookings
│       ├── middleware/        # JWT auth + role guards
│       ├── routes/
│       ├── sockets/           # Socket.IO real-time
│       ├── utils/             # Auth helpers, Zod validation, responses
│       └── server.ts          # Entry point
├── frontend/                  # Next.js app (to be scaffolded)
└── docs/
```

---

## Prerequisites (all free)

| Tool          | Version     | Install |
|---------------|-------------|---------|
| Docker Desktop| Latest      | https://www.docker.com/products/docker-desktop |
| Node.js       | 18 or 20 LTS| https://nodejs.org |
| Git           | Any         | – |

---

## How to Run – Detailed Step-by-Step

### 1. Start the infrastructure (MySQL + Redis)

Open a terminal in the project root (`localink/`):

```bash
docker compose up -d
```

This starts:
- **MySQL 8** on `localhost:3306`  
  Database: `localink`  
  User: `localink` / Password: `localinkpass`  
  Root password: `rootpassword`
- **Redis 7** on `localhost:6379`

Check health:

```bash
docker compose ps
docker logs localink-mysql
docker logs localink-redis
```

The schema + seed data (categories & services) are automatically applied on first start.

### 2. Start the Backend API

```bash
cd backend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev
```

You should see:

```
✅ MySQL connected successfully
✅ Redis connected
🚀 Localink API running
   → http://localhost:4000
   → API base: http://localhost:4000/api/v1
   → Health:   http://localhost:4000/api/v1/health
```

### 3. Test the API quickly

**Health check**
```bash
curl http://localhost:4000/api/v1/health
```

**Register a customer**
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@test.com",
    "password": "password123",
    "fullName": "Test Customer",
    "role": "customer"
  }'
```

**Register a provider**
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "plumber@test.com",
    "password": "password123",
    "fullName": "Ravi Plumber",
    "role": "provider"
  }'
```

**Login**
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@test.com","password":"password123"}'
```

Copy the `token` from the response and use it as:

```
Authorization: Bearer <token>
```

**List categories / services**
```bash
curl http://localhost:4000/api/v1/categories
curl http://localhost:4000/api/v1/services
```

**Geo search (public)**
```bash
curl "http://localhost:4000/api/v1/providers/search?lat=28.6139&lng=77.2090&radiusKm=10"
```

### 4. Frontend (Next.js) – Scaffold when ready

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Then implement the screens listed in the original plan (customer home, map, request form, booking tracker, provider dashboard).

### 5. Stopping everything

```bash
# Stop backend: Ctrl+C

# Stop Docker
docker compose down

# To also delete data volumes:
docker compose down -v
```

---

## Key API Endpoints (v1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | – | Register customer or provider |
| POST | `/auth/login` | – | Login → JWT |
| GET | `/auth/me` | JWT | Current user + provider profile |
| GET | `/categories` | – | List service categories |
| GET | `/services` | – | List services (optional `?categoryId=`) |
| PUT | `/providers/me` | Provider | Update business name, bio, location… |
| POST | `/providers/online` | Provider | Go online/offline + set live location |
| GET | `/providers/search` | – | Geo radius search |
| POST | `/requests` | Customer | Create service request |
| POST | `/requests/:id/accept` | Provider | Atomic accept (409 if already taken) |
| GET | `/bookings` | JWT | My bookings |
| GET | `/bookings/:id` | JWT | Booking details |
| PATCH | `/bookings/:id/status` | Provider | State machine transitions |

---

## Booking State Machine (enforced on server)

```
searching → accepted → on_the_way → in_progress → completed
     ↘           ↘          ↘            ↘
      cancelled / expired
```

Acceptance is **atomic**:
```sql
UPDATE requests SET status='accepted' WHERE id=? AND status='searching'
```
If 0 rows affected → HTTP 409 Conflict.

---

## Real-time (Socket.IO)

Connect with JWT:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: 'YOUR_JWT' }
});

socket.emit('booking:join', bookingId);
socket.on('chat:message', (msg) => { ... });
socket.on('booking:status', (data) => { ... });
socket.on('provider:location', (data) => { ... });
```

---

## Where everything runs

| Component | Runs on | Port | Notes |
|-----------|---------|------|-------|
| MySQL | Docker container | 3306 | Data persists in Docker volume |
| Redis | Docker container | 6379 | Used for GEO, presence, pub/sub |
| Backend API | Your machine (Node) | 4000 | `npm run dev` |
| Frontend | Your machine (Next.js) | 3000 | Later |
| Socket.IO | Same as API | 4000 | WebSocket upgrade |

All of this works **100% offline** after the first `docker pull` and `npm install`. No paid cloud services required for development or local pilot.

---

## Production / Free hosting notes

When you are ready to go live (after local pilot):

1. Keep MySQL + Redis on a free/cheap VPS or use PlanetScale / Railway / Render free tiers (check commercial terms).
2. Deploy the Node API to Railway / Render / Fly.io free tier.
3. Deploy Next.js to Vercel free tier.
4. Change all secrets and set proper CORS origins.
5. Read each host’s terms before accepting real money.

---

## Next recommended steps

1. Manually approve the first providers in the DB (`UPDATE providers SET is_approved=1`).
2. Implement the chat endpoints + message persistence.
3. Add BullMQ for request timeout / radius expansion.
4. Scaffold the Next.js frontend with the main screens.
5. Write a few Playwright e2e tests.

The backend you have now is solid, type-safe, and ready for real use. Just run the commands above and start testing with curl or Postman.
