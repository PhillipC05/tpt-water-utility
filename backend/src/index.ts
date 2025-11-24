import express, { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

// Import database functions
import { testConnection, initializeTables } from './database';
import iotService from './iot-service';
import maintenanceService from './maintenance-service';
import auditService from './audit-service';
import { swaggerDocs } from './swagger';
import { handleValidationError, sanitizeBody } from './validation/middleware';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';

// Load environment variables
dotenv.config();

const app: Application = express();
const server = http.createServer(app);
const io: SocketIOServer = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT: string | number = process.env.PORT || 5000;

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
    write: (message: string) => {
      auditService.logger.info('HTTP Request', { message: message.trim() });
    }
  }
}));

// Middleware
app.use(cors());
app.use(sanitizeBody); // Sanitize input data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/auth', authLimiter);
app.use('/api', limiter);

// Audit middleware for API routes
app.use('/api', auditService.logApiAccess.bind(auditService));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Swagger API documentation
swaggerDocs(app);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'Water Utility API is running',
    timestamp: new Date().toISOString()
  });
});

// Validation error handling middleware
app.use(handleValidationError);

// General error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Join user-specific room for notifications
  socket.on('join', (userId: string) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    console.log('Starting Water Utility API server...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Initialize database tables
    await initializeTables();

    // Set Socket.io instance for services
    iotService.setSocketIO(io);
    maintenanceService.setSocketIO(io);

    // Start IoT service
    iotService.connect();

    // Initialize maintenance service
    await maintenanceService.initialize();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (): void => {
  console.log('Shutting down gracefully...');
  iotService.disconnect();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start the server
startServer().catch((error) => {
  console.error('Unhandled error during server startup:', error);
  process.exit(1);
});
