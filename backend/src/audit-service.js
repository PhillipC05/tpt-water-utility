const winston = require('winston');
const db = require('./database');

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'water-utility-api' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

class AuditService {
  constructor() {
    this.logger = logger;
  }

  // Log user authentication events
  logAuthEvent(event, userId, details = {}) {
    const logEntry = {
      event: 'auth',
      subEvent: event,
      userId: userId,
      details: details,
      ip: details.ip,
      userAgent: details.userAgent
    };

    this.logger.info('Authentication event', logEntry);
    this.saveToDatabase(logEntry);
  }

  // Log API access events
  logApiAccess(req, res, next) {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const duration = Date.now() - start;
      const logEntry = {
        event: 'api_access',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: duration,
        userId: req.user ? req.user.id : null,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      // Log based on status code
      if (res.statusCode >= 400) {
        this.logger.warn('API access with error', logEntry);
      } else if (duration > 1000) { // Log slow requests
        this.logger.warn('Slow API request', logEntry);
      } else {
        this.logger.info('API access', logEntry);
      }

      this.saveToDatabase(logEntry);
      originalSend.call(this, data);
    }.bind(this);

    next();
  }

  // Log data modification events
  logDataChange(event, table, recordId, userId, changes = {}) {
    const logEntry = {
      event: 'data_change',
      subEvent: event,
      table: table,
      recordId: recordId,
      userId: userId,
      changes: changes,
      timestamp: new Date().toISOString()
    };

    this.logger.info('Data change event', logEntry);
    this.saveToDatabase(logEntry);
  }

  // Log security events
  logSecurityEvent(event, details = {}) {
    const logEntry = {
      event: 'security',
      subEvent: event,
      details: details,
      timestamp: new Date().toISOString()
    };

    this.logger.warn('Security event', logEntry);
    this.saveToDatabase(logEntry);
  }

  // Log system events
  logSystemEvent(event, details = {}) {
    const logEntry = {
      event: 'system',
      subEvent: event,
      details: details,
      timestamp: new Date().toISOString()
    };

    this.logger.info('System event', logEntry);
    this.saveToDatabase(logEntry);
  }

  // Save log entry to database
  saveToDatabase(logEntry) {
    try {
      db.run(
        `INSERT INTO audit_logs
         (event_type, sub_event, user_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          logEntry.event,
          logEntry.subEvent || null,
          logEntry.userId || null,
          JSON.stringify(logEntry.details || {}),
          logEntry.ip || null,
          logEntry.userAgent || null,
          logEntry.timestamp || new Date().toISOString()
        ],
        (err) => {
          if (err) {
            console.error('Error saving audit log to database:', err);
          }
        }
      );
    } catch (error) {
      console.error('Error in audit logging:', error);
    }
  }

  // Query audit logs with filters
  async queryLogs(filters = {}, limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (filters.event_type) {
        query += ' AND event_type = ?';
        params.push(filters.event_type);
      }

      if (filters.sub_event) {
        query += ' AND sub_event = ?';
        params.push(filters.sub_event);
      }

      if (filters.user_id) {
        query += ' AND user_id = ?';
        params.push(filters.user_id);
      }

      if (filters.start_date) {
        query += ' AND created_at >= ?';
        params.push(filters.start_date);
      }

      if (filters.end_date) {
        query += ' AND created_at <= ?';
        params.push(filters.end_date);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Get audit statistics
  async getAuditStats(days = 30) {
    return new Promise((resolve, reject) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = `
        SELECT
          event_type,
          sub_event,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM audit_logs
        WHERE created_at >= ?
        GROUP BY event_type, sub_event
        ORDER BY count DESC
      `;

      db.all(query, [startDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Clean up old logs (keep last N days)
  async cleanupOldLogs(daysToKeep = 90) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      db.run(
        'DELETE FROM audit_logs WHERE created_at < ?',
        [cutoffDate.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new AuditService();
