# Water Utility Management System

A comprehensive, enterprise-grade water utility management platform built with modern technologies for real-time monitoring, predictive maintenance, and advanced analytics.

## 🚀 Features

### Core Functionality
- **Real-time IoT Sensor Monitoring** - Live data streaming from water sensors (flow, pressure, level, quality, temperature)
- **Automated Alert System** - Intelligent threshold monitoring with email/SMS notifications and outbound webhooks
- **Predictive Maintenance** - Scheduled maintenance with automated notifications and tracking
- **Advanced Analytics & Reporting** - System summary, water quality, and energy reports
- **Non-Revenue Water (NRW) Calculator** - Automated water loss analysis comparing production to billed consumption
- **Statistical Anomaly Detection** - Z-score based outlier detection across all sensor streams
- **Customer & Billing Management** - Full customer lifecycle, meter readings, bills, and payments
- **User Management** - Role-based access control with customizable notification preferences
- **Webhook Integrations** - Push events to Slack, Teams, PagerDuty, or any HTTP endpoint

### Technical Features
- **Real-time Updates** - WebSocket integration for live dashboard updates
- **Comprehensive Security** - Rate limiting, audit logging, input validation, Helmet.js
- **Scalable Architecture** - PostgreSQL + Redis support with Docker deployment
- **API Documentation** - Complete Swagger/OpenAPI documentation
- **Testing Framework** - Jest + Supertest for comprehensive testing
- **Progressive Web App** - PWA features for offline capability

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Database**: PostgreSQL (production) / SQLite (development)
- **Cache**: Redis for session management and performance
- **Real-time**: Socket.io for live updates
- **Security**: Helmet, rate limiting, audit logging
- **Documentation**: Swagger/OpenAPI

### Frontend (React)
- **UI Framework**: React with modern hooks
- **Charts**: Chart.js for data visualization
- **Real-time**: Socket.io client for live updates
- **Styling**: CSS with responsive design
- **PWA**: Service workers for offline functionality

### IoT Integration
- **MQTT Protocol** - Industry-standard IoT communication
- **Sensor Types**: Flow, pressure, water level, quality, temperature
- **Real-time Processing** - Automatic threshold checking and alerting

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (production)
- Redis 7+ (production)

## 🚀 Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/PhillipC05/tpt-water-utility.git
   cd tpt-water-utility
   ```

2. **Configure secrets**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env and set JWT_SECRET and DB_PASS
   ```

3. **Start the services**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:5000/api-docs
   - Backend API: http://localhost:5000

### Local Development

1. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Start services**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev

   # Terminal 2: Frontend
   cd frontend
   npm start

   # Terminal 3: PostgreSQL & Redis (via Docker)
   docker-compose up postgres redis -d
   ```

## 🔧 Configuration

### Environment Variables

Create `.env` files in both `backend/` and `frontend/` directories:

#### Backend (.env)
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000

# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=water_utility
DB_USER=wateruser
DB_PASS=waterpass

# Redis
REDIS_URL=redis://localhost:6379

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# MQTT
MQTT_BROKER=mqtt://localhost:1883
MQTT_TOPIC=water/utility/#
```

#### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_API_DOCS_URL=http://localhost:5000/api-docs
```

## 📊 API Documentation

Access the interactive API documentation at `http://localhost:5000/api-docs` when the backend is running.

### Key Endpoints

- **Authentication**: `/auth/login`, `/auth/register`, `/auth/change-password`
- **Sensors**: `/api/sensors` - Full CRUD + paginated readings
- **Alerts**: `/api/alerts` - Create, acknowledge, resolve, delete; filter by status/severity
- **Maintenance**: `/api/maintenance` + `/api/maintenance/history` + `/api/maintenance/upcoming`
- **Reports**: `/api/reports/summary`, `/api/reports/water-quality`, `/api/reports/energy`
- **Analytics**: `/api/analytics/nrw` (Non-Revenue Water), `/api/analytics/anomalies`, `/api/analytics/sensor-trends`
- **Customers**: `/api/customers` - Full CRUD + CSV export
- **Billing**: `/api/billing-cycles`, `/api/bills`, `/api/payments`, `/api/meter-readings`
- **Webhooks**: `/api/webhooks` - Register and manage outbound event hooks
- **Work Orders**: `/api/work-orders`, `/api/service-requests`
- **Audit Logs**: `/api/audit` - Security and activity logs with cleanup
- **User Profile**: `/api/users/me` - Self-service profile update

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests (if implemented)
cd frontend
npm test
```

## 🔒 Security Features

- **Rate Limiting**: 100 requests/15min per IP, stricter for auth
- **Helmet.js**: Security headers and XSS protection
- **Input Validation**: Comprehensive validation using express-validator
- **Audit Logging**: Complete activity tracking with Winston
- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Admin and operator permissions

## 📈 Monitoring & Analytics

- **Real-time Dashboards**: Live sensor data visualization
- **Historical Trends**: Time-series analysis with filtering
- **Alert Analytics**: Alert type distribution and frequency
- **Asset Status**: Equipment health monitoring
- **PDF Reports**: Automated report generation

## 🚀 Deployment

### Production Deployment

1. **Update environment variables** for production settings
2. **Use PostgreSQL and Redis** instead of SQLite
3. **Enable SSL/TLS** for secure communication
4. **Configure reverse proxy** (nginx recommended)
5. **Set up monitoring** and alerting

### Docker Production

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale services as needed
docker-compose up -d --scale water-utility-api=3
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TPT Solutions** - Project sponsors and visionaries
- **Open Source Community** - For the amazing tools and libraries
- **Water Industry Professionals** - For domain expertise and requirements

## 📞 Support

For support, email support@waterutility.com or create an issue in the repository.

---

**Built with ❤️ by TPT Solutions**
