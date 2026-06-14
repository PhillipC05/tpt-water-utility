import winston, { Logger } from 'winston';
import { query } from './database';

// Configure Winston logger
const logger: Logger = winston.createLogger({
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

interface AuditLogEntry {
  event: string;
  subEvent?: string;
  userId?: number | string | null;
  details?: any;
  ip?: string;
  userAgent?: string;
  table?: string;
  recordId?: number | string;
  changes?: any;
  timestamp?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
}

interface AuditFilters {
  event_type?: string;
  sub_event?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

interface AuditStats {
  event_type: string;
  sub_event: string | null;
  count: number;
  last_occurrence: string;
}

class AuditService {
  public logger: Logger;

  constructor() {
    this.logger = logger;
  }

  // Log user authentication events
  logAuthEvent(event: string, userId: number | string | null, details: any = {}): void {
    const logEntry: AuditLogEntry = {
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
  logApiAccess(req: any, res: any, next: () => void): void {
    const start = Date.now();
    const originalSend = res.send;
    const self = this; // Capture 'this' reference

    res.send = function(data: any) {
      const duration = Date.now() - start;
      const logEntry: AuditLogEntry = {
        event: 'api_access',
        userId: req.user ? req.user.id : null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
        },
      };

      // Log based on status code
      if (res.statusCode >= 400) {
        self.logger.warn('API access with error', logEntry);
      } else if (duration > 1000) { // Log slow requests
        self.logger.warn('Slow API request', logEntry);
      } else {
        self.logger.info('API access', logEntry);
      }

      self.saveToDatabase(logEntry);
      originalSend.call(this, data);
    };

    next();
  }

  // Log data modification events
  logDataChange(event: string, table: string, recordId: number | string, userId: number | string | null, changes: any = {}): void {
    const logEntry: AuditLogEntry = {
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
  logSecurityEvent(event: string, details: any = {}): void {
    const logEntry: AuditLogEntry = {
      event: 'security',
      subEvent: event,
      details: details,
      timestamp: new Date().toISOString()
    };

    this.logger.warn('Security event', logEntry);
    this.saveToDatabase(logEntry);
  }

  // Log system events
  logSystemEvent(event: string, details: any = {}): void {
    const logEntry: AuditLogEntry = {
      event: 'system',
      subEvent: event,
      details: details,
      timestamp: new Date().toISOString()
    };

    this.logger.info('System event', logEntry);
    this.saveToDatabase(logEntry);
  }

  // Save log entry to database
  private saveToDatabase(logEntry: AuditLogEntry): void {
    try {
      query(
        `INSERT INTO audit_logs
         (event_type, sub_event, user_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          logEntry.event,
          logEntry.subEvent || null,
          logEntry.userId || null,
          JSON.stringify(logEntry.details || {}),
          logEntry.ip || null,
          logEntry.userAgent || null,
          logEntry.timestamp || new Date().toISOString()
        ]
      ).catch((err) => {
        console.error('Error saving audit log to database:', err);
      });
    } catch (error) {
      console.error('Error in audit logging:', error);
    }
  }

  // Query audit logs with filters
  async queryLogs(filters: AuditFilters = {}, limit: number = 100, offset: number = 0): Promise<any[]> {
    let queryText = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.event_type) {
      queryText += ' AND event_type = $' + (params.length + 1);
      params.push(filters.event_type);
    }

    if (filters.sub_event) {
      queryText += ' AND sub_event = $' + (params.length + 1);
      params.push(filters.sub_event);
    }

    if (filters.user_id) {
      queryText += ' AND user_id = $' + (params.length + 1);
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      queryText += ' AND created_at >= $' + (params.length + 1);
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      queryText += ' AND created_at <= $' + (params.length + 1);
      params.push(filters.end_date);
    }

    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await query(queryText, params);
    return result.rows;
  }

  // Get audit statistics
  async getAuditStats(days: number = 30): Promise<AuditStats[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await query(
      `
      SELECT
        event_type,
        sub_event,
        COUNT(*) as count,
        MAX(created_at) as last_occurrence
      FROM audit_logs
      WHERE created_at >= $1
      GROUP BY event_type, sub_event
      ORDER BY count DESC
      `,
      [startDate.toISOString()]
    );

    return result.rows;
  }

  // Clean up old logs (keep last N days)
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await query(
      'DELETE FROM audit_logs WHERE created_at < $1',
      [cutoffDate.toISOString()]
    );

    return result.rowCount || 0;
  }
}

const auditService = new AuditService();
export default auditService;
