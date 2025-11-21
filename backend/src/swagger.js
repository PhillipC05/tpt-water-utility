const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Water Utility Management API',
      version: '1.0.0',
      description: 'Comprehensive API for water utility management system with IoT integration, real-time monitoring, and maintenance scheduling',
      contact: {
        name: 'API Support',
        email: 'support@waterutility.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.waterutility.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'operator'] },
            phone: { type: 'string' },
            email_notifications: { type: 'boolean' },
            sms_notifications: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Sensor: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['flow', 'pressure', 'level', 'quality', 'temperature'] },
            location: { type: 'string' },
            status: { type: 'string', enum: ['active', 'inactive'] },
            last_reading: { type: 'number' },
            last_updated: { type: 'string', format: 'date-time' }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            type: { type: 'string' },
            message: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] },
            sensor_id: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        MaintenanceSchedule: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            asset_id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            schedule_type: { type: 'string' },
            cron_expression: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            estimated_duration: { type: 'integer' },
            assigned_to: { type: 'integer' },
            is_active: { type: 'boolean' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'] // Path to the API routes
};

const specs = swaggerJSDoc(options);

module.exports = {
  swaggerUi,
  specs,
  swaggerDocs: (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      swaggerOptions: {
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true
      }
    }));

    // Serve swagger JSON
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });
  }
};
