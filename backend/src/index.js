const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import database functions
const { testConnection, initializeTables } = require('./database');
const iotService = require('./iot-service');
const maintenanceService = require('./maintenance-service');
const auditService = require('./audit-service');
const { swaggerDocs } = require('./swagger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Make io accessible to routes
app.set('io', io);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => {
      auditService.logger.info('HTTP Request', { message: message.trim() });
    }
  }
}));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/auth', authLimiter);
app.use('/api', limiter);

// Audit middleware for API routes
app.use('/api', auditService.logApiAccess.bind(auditService));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// Swagger API documentation
swaggerDocs(app);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Water Utility API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Join user-specific room for notifications
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });
});

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Initialize database tables
  try {
    await initializeTables();
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
    process.exit(1);
  }

  // Set Socket.io instance for services
  iotService.setSocketIO(io);
  maintenanceService.setSocketIO(io);

  // Start IoT service
  iotService.connect();

  // Initialize maintenance service
  await maintenanceService.initialize();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  iotService.disconnect();
  server.close(() => {
    process.exit(0);
  });
});
