# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive water utility management platform built with a Node.js/Express backend and React frontend. The system provides real-time IoT sensor monitoring, predictive maintenance, advanced analytics, and automated alert systems for water utilities.

**Key Technologies:**
- **Backend**: Node.js, Express, SQLite (dev) / PostgreSQL (prod), Socket.io
- **Frontend**: React 19, Chart.js, Socket.io-client
- **Infrastructure**: Docker, MQTT (for IoT), Redis (caching)
- **Security**: Helmet.js, JWT authentication, rate limiting, audit logging

## Development Commands

### Backend (from `backend/` directory)
```bash
npm install              # Install dependencies
npm run dev              # Start dev server with nodemon (port 5000)
npm start                # Start production server
npm test                 # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report
```

### Frontend (from `frontend/` directory)
```bash
npm install              # Install dependencies
npm start                # Start dev server (port 3000)
npm run build            # Build for production
npm test                 # Run tests
```

### Docker Deployment
```bash
# From root directory
docker-compose -f docker/docker-compose.yml up -d    # Start all services
docker-compose -f docker/docker-compose.yml down     # Stop all services

# Start specific services
docker-compose -f docker/docker-compose.yml up postgres redis -d
```

## Architecture

### Backend Structure (`backend/src/`)

**Core Files:**
- `index.js` - Express app initialization, Socket.io setup, middleware configuration
- `database.js` - SQLite database initialization with schema definitions
- `swagger.js` - API documentation setup (Swagger/OpenAPI)

**Services:**
- `iot-service.js` - MQTT client for IoT sensor data ingestion
- `maintenance-service.js` - Scheduled maintenance tracking with notifications
- `notification-service.js` - Email (SMTP) and SMS (Twilio) notifications
- `audit-service.js` - Winston-based logging and audit trail

**Routes:**
- `routes/auth.js` - Authentication endpoints (login, register)
- `routes/api.js` - Main API routes (sensors, readings, alerts, maintenance, reports, etc.)

**Middleware:**
- `middleware/auth.js` - JWT authentication and role-based authorization

### Frontend Structure (`frontend/src/`)

**Main Components:**
- `App.js` - Router setup with SocketProvider wrapper
- `socket.js` - Socket.io client context provider
- `components/` - Page components (Dashboard, Sensors, Alerts, Reports, etc.)

**Key Features:**
- Real-time updates via Socket.io
- Chart.js for data visualization
- React Router for navigation
- JWT token storage in localStorage

### Database Schema

The SQLite database (`backend/database/water_utility.db`) contains these tables:
- `users` - User accounts with role-based access (admin, operator)
- `sensors` - IoT sensor registry (flow, pressure, level, quality, temperature)
- `readings` - Time-series sensor data
- `assets` - Equipment/asset tracking
- `alerts` - System alerts and notifications
- `maintenance_schedules` - Preventive maintenance planning
- `audit_logs` - Security and activity audit trail
- `customers`, `service_requests`, `work_orders` - Customer management

## Real-time Communication

The application uses Socket.io for bidirectional real-time updates:

**Backend Setup:**
- Socket.io server initialized in `index.js`
- `io` instance passed to services via `setSocketIO(io)`
- Services emit events: `iotService` (sensor readings), `maintenanceService` (maintenance alerts)

**Frontend Setup:**
- SocketProvider wraps the app in `App.js`
- Components access socket via `useSocket()` hook from `socket.js`
- Join user-specific rooms: `socket.emit('join', userId)`

**Events:**
- `sensor_reading` - New sensor data received
- `maintenance_alert` - Scheduled maintenance notification
- `alert` - System alerts (threshold violations, etc.)

## Authentication & Authorization

**JWT Flow:**
1. User logs in via `/auth/login` endpoint
2. Backend validates credentials and returns JWT token
3. Frontend stores token in localStorage
4. Protected routes use `authenticateToken` middleware
5. Role-based access via `authorizeRoles('admin', 'operator')` middleware

**Roles:**
- `admin` - Full access (CRUD operations, user management)
- `operator` - Read access + limited write operations

## Security Features

- **Rate Limiting**: 100 req/15min for API, 5 req/15min for auth
- **Helmet.js**: Security headers, XSS protection, CSP
- **Input Validation**: Required for all POST/PUT endpoints
- **Audit Logging**: All API access logged via `auditService.logApiAccess()`
- **Payload Limits**: 10MB max for JSON/URL-encoded bodies

## IoT Integration

**MQTT Configuration:**
- Broker: Eclipse Mosquitto (port 1883)
- Topic pattern: `water/utility/#`
- Message format: JSON with `sensor_id`, `value`, `type`, `unit`

**Sensor Types Supported:**
- `flow` - Water flow rate
- `pressure` - System pressure
- `level` - Water level/tank capacity
- `quality` - Water quality metrics
- `temperature` - Temperature monitoring

## Testing

**Backend Tests:**
- Framework: Jest + Supertest
- Config: `jest.config.js`
- Test files: `backend/tests/*.test.js`
- Setup: `tests/setup.js` (test database initialization)

**Running Tests:**
```bash
cd backend
npm test                 # Run all tests
npm run test:coverage    # With coverage report
```

## API Documentation

Access interactive Swagger docs at `http://localhost:5000/api-docs` when backend is running.

**Key Endpoint Groups:**
- `/auth/*` - Authentication
- `/api/sensors/*` - Sensor management
- `/api/readings/*` - Sensor data
- `/api/alerts/*` - Alert management
- `/api/maintenance/*` - Maintenance scheduling
- `/api/reports/*` - Analytics and PDF reports
- `/api/audit/*` - Audit logs

## Environment Configuration

**Backend `.env` (required):**
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=<secret>
DB_PATH=./database/water_utility.db
MQTT_BROKER=mqtt://localhost:1883
MQTT_TOPIC=water/utility/#
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<password>
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=<number>
```

**Frontend `.env` (optional):**
```env
REACT_APP_BACKEND_URL=http://localhost:5000
```

## Common Patterns

### Adding a New API Endpoint
1. Add route handler in `backend/src/routes/api.js`
2. Use `authenticateToken` middleware for protected routes
3. Use `authorizeRoles()` for role-based access
4. Add Swagger JSDoc comments for API documentation
5. Handle errors with try-catch or callbacks
6. Emit Socket.io events for real-time updates if needed

### Adding a New Frontend Component
1. Create component in `frontend/src/components/`
2. Import and add route in `App.js`
3. Use `useSocket()` hook for real-time data
4. Store auth token from localStorage: `localStorage.getItem('token')`
5. Include token in API requests: `Authorization: Bearer ${token}`

### Database Migrations
- No formal migration system
- Schema changes made directly in `database.js`
- Tables created with `CREATE TABLE IF NOT EXISTS`
- For production, consider using PostgreSQL with proper migrations

## Deployment Notes

**Docker Deployment:**
- Services defined in `docker/docker-compose.yml`
- Backend uses SQLite by default (switch to PostgreSQL for production)
- Frontend served via nginx in production container
- MQTT broker (Mosquitto) runs as separate service
- PostgreSQL and Redis available but not used by default backend

**Production Checklist:**
- Update JWT_SECRET to secure random value
- Configure SMTP and Twilio credentials
- Switch from SQLite to PostgreSQL (update DB_TYPE env var)
- Enable Redis for session management
- Configure reverse proxy (nginx) with SSL/TLS
- Set appropriate rate limits
- Review Helmet.js CSP directives

## Project Structure Summary

```
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app entry point
│   │   ├── database.js           # Database initialization
│   │   ├── routes/               # API routes
│   │   ├── middleware/           # Auth middleware
│   │   └── *-service.js          # Business logic services
│   ├── tests/                    # Jest tests
│   └── database/                 # SQLite database file
├── frontend/
│   ├── src/
│   │   ├── App.js               # React router setup
│   │   ├── socket.js            # Socket.io context
│   │   └── components/          # React components
│   └── public/                  # Static assets
└── docker/                      # Docker configuration
```
