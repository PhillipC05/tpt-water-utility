# Water Utility Management System - Development Context

## Project Overview

The Water Utility Management System is an enterprise-grade platform for water utility companies, providing real-time IoT sensor monitoring, predictive maintenance, advanced analytics, and comprehensive management tools. Built with a modern tech stack including Node.js/Express for the backend and React for the frontend.

### Core Architecture
- **Backend**: Node.js/Express.js with PostgreSQL (production) or SQLite (development) database
- **Frontend**: React application with real-time updates via Socket.io
- **Real-time Communication**: MQTT for IoT sensor data, Socket.io for live dashboard updates
- **Containerization**: Docker and Docker Compose for deployment

### Key Features
- Real-time IoT sensor monitoring (flow, pressure, level, quality, temperature)
- Automated alert system with email/SMS notifications
- Predictive maintenance scheduling
- Advanced analytics and reporting
- Role-based user management
- Progressive Web App (PWA) capabilities
- Regulatory compliance tracking
- Customer account and billing management
- Work order and service request management
- Energy consumption monitoring
- Leak detection and water loss tracking

## Project Structure

```
TPT Water Utility/
├── LICENSE
├── README.md
├── package.json
├── backend/
│   ├── .env
│   ├── package.json
│   ├── jest.config.js
│   ├── src/
│   │   ├── index.js (main server entry point)
│   │   ├── database.js (SQLite/PostgreSQL setup)
│   │   ├── iot-service.js (MQTT service for sensor data)
│   │   ├── notification-service.js (email/SMS notifications)
│   │   ├── maintenance-service.js
│   │   ├── audit-service.js
│   │   ├── swagger.js (API documentation)
│   │   ├── routes/ (API routes)
│   │   └── middleware/
│   └── tests/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js (main React component)
│   │   ├── socket.js (Socket.io client)
│   │   └── components/ (UI components)
│   └── package.json
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
└── scripts/
```

## Backend Architecture

### Main Services
- **index.js**: Main server initialization with Express, Socket.io, and security middleware
- **iot-service.js**: Handles MQTT communication with IoT sensors and processes real-time data
- **notification-service.js**: Manages email and SMS notifications via Nodemailer and Twilio
- **database.js**: SQLite database initialization with tables for users, sensors, readings, alerts, maintenance, etc.
- **audit-service.js**: Security logging for access control and activity tracking

### Database Schema (SQLite)
- `users`: Authentication and role management
- `sensors`: IoT sensor information and status
- `readings`: Historical sensor data
- `alerts`: System alerts with severity levels
- `assets`: Water utility equipment tracking
- `maintenance_schedules` and `maintenance_logs`: Predictive maintenance
- `compliance_standards`: Regulatory compliance tracking
- `customers`: Customer account management
- `bills`: Billing and payment tracking
- `service_requests` and `work_orders`: Service request management
- `notification_logs`: History of sent notifications
- `audit_logs`: Security and audit trail

### Key Dependencies
- `express`: Web framework
- `mqtt`: IoT device communication
- `socket.io`: Real-time web functionality
- `sqlite3`: Database
- `jsonwebtoken`: Authentication
- `nodemailer`: Email notifications
- `twilio`: SMS notifications
- `helmet`: Security headers
- `express-rate-limit`: Rate limiting
- `winston`: Logging

## Frontend Architecture

### Key Components
- **App.js**: Main application router with navigation
- **socket.js**: Socket.io connection provider for real-time updates
- **components/**: Modular UI components for various system features
  - Dashboard: Real-time monitoring
  - Sensors: Sensor data management
  - Alerts: Alert monitoring and management
  - Assets: Equipment monitoring
  - Customers: Customer account management
  - Reports: Analytics and reporting
  - Service requests and Work orders: Ticketing system

### Key Dependencies
- `react`: UI framework
- `react-router-dom`: Navigation
- `socket.io-client`: Real-time communication with backend
- `chart.js` and `react-chartjs-2`: Data visualization
- `axios`: API communication

## Building and Running

### Using Docker (Recommended)
```bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# API Documentation: http://localhost:5000/api-docs
```

### Local Development
```bash
# Backend setup
cd backend
npm install
npm run dev

# Frontend setup
cd frontend
npm install
npm start

# Start database and MQTT broker with Docker
docker-compose up postgres redis mosquitto -d
```

### Environment Variables
Both backend and frontend require environment configuration. The backend needs:
- JWT_SECRET for authentication
- Database connection details
- Redis URL for caching
- SMTP settings for email notifications
- Twilio credentials for SMS
- MQTT broker settings

The frontend needs:
- REACT_APP_BACKEND_URL for API communication

## Development Conventions

### Backend
- Express.js REST API with JWT authentication
- Middleware for security (helmet, rate limiting, CORS)
- Socket.io for real-time updates
- MQTT for IoT communication
- Comprehensive error handling
- Structured logging with Winston
- Security audit logging for all API access

### Frontend
- Component-based architecture
- Socket.io for real-time dashboard updates
- Responsive design principles
- React hooks for state management
- Chart.js for data visualization

### Testing
- Jest for backend unit testing
- React Testing Library for frontend testing
- Supertest for API testing

### Security Features
- JWT-based authentication
- Rate limiting (100 requests/15min, stricter for auth)
- Helmet.js security headers
- Input validation
- Complete audit logging
- Role-based access control

## Key Functionalities

### IoT Integration
- Real-time sensor data processing via MQTT
- Automatic threshold monitoring with alerts
- Sensor status tracking

### Alert System
- Automated threshold-based alerts
- Email and SMS notifications
- Multi-channel notification system
- Severity-based routing

### Maintenance Management
- Predictive maintenance scheduling
- Work order tracking
- Asset monitoring and status

### Regulatory Compliance
- Standards tracking
- Report generation
- Compliance audit trails

### Customer Management
- Account creation and billing
- Service request handling
- Payment processing

## Common Development Tasks

### Adding New Endpoints
1. Create route in `backend/src/routes/`
2. Update database in `backend/src/database.js` if needed
3. Update API documentation in `backend/src/swagger.js`

### Adding New Frontend Components
1. Create component in `frontend/src/components/`
2. Add route to `frontend/src/App.js`
3. Implement Socket.io integration if real-time data needed

### Database Changes
1. Update `backend/src/database.js` with new tables/fields
2. Consider migration strategy for production
3. Update all relevant services to handle new schema

### IoT Integration
1. Update `backend/src/iot-service.js` for new sensor types
2. Modify `extractValueFromPayload` for new data formats
3. Adjust threshold checking in `checkThresholds` method

## Troubleshooting

### Common Issues
- **Database**: Check `DB_PATH` in backend `.env`
- **Real-time updates**: Verify Socket.io connection and MQTT broker status
- **Notifications**: Ensure SMTP and Twilio credentials are correct
- **Frontend API calls**: Confirm `REACT_APP_BACKEND_URL` is properly set

### Monitoring
- Check Docker container logs: `docker-compose logs -f`
- Review audit logs for security events
- Monitor database for performance issues
- Track notification delivery success rates