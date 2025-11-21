const cron = require('node-cron');
const db = require('./database');
const notificationService = require('./notification-service');

class MaintenanceService {
  constructor() {
    this.scheduledJobs = new Map();
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async initialize() {
    await this.loadActiveSchedules();
    console.log('Maintenance service initialized');
  }

  async loadActiveSchedules() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM maintenance_schedules WHERE is_active = 1',
        [],
        (err, schedules) => {
          if (err) {
            console.error('Error loading maintenance schedules:', err);
            reject(err);
            return;
          }

          // Clear existing jobs
          this.scheduledJobs.forEach(job => job.destroy());
          this.scheduledJobs.clear();

          // Schedule new jobs
          schedules.forEach(schedule => {
            this.scheduleMaintenanceJob(schedule);
          });

          console.log(`Loaded ${schedules.length} active maintenance schedules`);
          resolve();
        }
      );
    });
  }

  scheduleMaintenanceJob(schedule) {
    try {
      if (!schedule.cron_expression) {
        console.warn(`No cron expression for schedule ${schedule.id}`);
        return;
      }

      const job = cron.schedule(schedule.cron_expression, async () => {
        await this.executeMaintenance(schedule);
      });

      this.scheduledJobs.set(schedule.id, job);
      console.log(`Scheduled maintenance job ${schedule.id} with cron: ${schedule.cron_expression}`);
    } catch (error) {
      console.error(`Error scheduling job ${schedule.id}:`, error);
    }
  }

  async executeMaintenance(schedule) {
    try {
      console.log(`Executing maintenance schedule ${schedule.id}: ${schedule.title}`);

      // Create maintenance log entry
      const logId = await this.createMaintenanceLog(schedule);

      // Update schedule last run time
      await this.updateScheduleLastRun(schedule.id);

      // Send notifications
      await this.notifyMaintenanceDue(schedule);

      // Emit real-time update
      if (this.io) {
        this.io.emit('maintenance_due', {
          scheduleId: schedule.id,
          title: schedule.title,
          asset_id: schedule.asset_id,
          priority: schedule.priority,
          due_date: new Date().toISOString()
        });
      }

      console.log(`Maintenance executed for schedule ${schedule.id}`);
    } catch (error) {
      console.error(`Error executing maintenance ${schedule.id}:`, error);
    }
  }

  createMaintenanceLog(schedule) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO maintenance_logs
         (schedule_id, asset_id, assigned_to, status, start_time)
         VALUES (?, ?, ?, 'scheduled', ?)`,
        [schedule.id, schedule.asset_id, schedule.assigned_to, new Date().toISOString()],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  updateScheduleLastRun(scheduleId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE maintenance_schedules SET last_run = ? WHERE id = ?',
        [new Date().toISOString(), scheduleId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async notifyMaintenanceDue(schedule) {
    try {
      // Get users to notify (assigned user and admins)
      const users = await this.getMaintenanceNotificationRecipients(schedule);

      const subject = `Maintenance Due: ${schedule.title}`;
      const message = `
Maintenance Schedule: ${schedule.title}
Description: ${schedule.description || 'No description provided'}
Asset ID: ${schedule.asset_id}
Priority: ${schedule.priority}
Estimated Duration: ${schedule.estimated_duration || 'Not specified'} minutes
Due Date: ${new Date().toLocaleString()}

Please complete this maintenance task as soon as possible.
      `.trim();

      // Send notifications
      for (const user of users) {
        if (user.email_notifications) {
          await notificationService.sendEmail(user.email, subject, message);
        }
        if (user.sms_notifications && user.phone) {
          await notificationService.sendSMS(user.phone, `MAINTENANCE DUE: ${schedule.title}`);
        }
      }
    } catch (error) {
      console.error('Error sending maintenance notifications:', error);
    }
  }

  getMaintenanceNotificationRecipients(schedule) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT id, email, phone, email_notifications, sms_notifications FROM users WHERE ';
      const params = [];

      if (schedule.assigned_to) {
        query += 'id = ? OR role = "admin"';
        params.push(schedule.assigned_to);
      } else {
        query += 'role IN ("admin", "operator")';
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // CRUD operations for maintenance schedules
  async createSchedule(scheduleData, userId) {
    return new Promise((resolve, reject) => {
      const {
        asset_id,
        title,
        description,
        schedule_type,
        cron_expression,
        priority,
        estimated_duration,
        assigned_to
      } = scheduleData;

      db.run(
        `INSERT INTO maintenance_schedules
         (asset_id, title, description, schedule_type, cron_expression, priority, estimated_duration, assigned_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [asset_id, title, description, schedule_type, cron_expression, priority || 'medium', estimated_duration, assigned_to, userId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            const newSchedule = {
              id: this.lastID,
              ...scheduleData,
              created_by: userId,
              is_active: true
            };

            // Schedule the job
            this.scheduleMaintenanceJob(newSchedule);

            resolve(newSchedule);
          }
        }.bind(this)
      );
    });
  }

  async updateSchedule(scheduleId, scheduleData) {
    return new Promise((resolve, reject) => {
      const {
        asset_id,
        title,
        description,
        schedule_type,
        cron_expression,
        priority,
        estimated_duration,
        assigned_to,
        is_active
      } = scheduleData;

      db.run(
        `UPDATE maintenance_schedules SET
         asset_id = ?, title = ?, description = ?, schedule_type = ?, cron_expression = ?,
         priority = ?, estimated_duration = ?, assigned_to = ?, is_active = ?, updated_at = ?
         WHERE id = ?`,
        [asset_id, title, description, schedule_type, cron_expression, priority, estimated_duration, assigned_to, is_active, new Date().toISOString(), scheduleId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            // Reload schedules if this one was updated
            this.loadActiveSchedules();
            resolve({ id: scheduleId, ...scheduleData });
          }
        }.bind(this)
      );
    });
  }

  async deleteSchedule(scheduleId) {
    return new Promise((resolve, reject) => {
      // Remove from scheduled jobs
      if (this.scheduledJobs.has(scheduleId)) {
        this.scheduledJobs.get(scheduleId).destroy();
        this.scheduledJobs.delete(scheduleId);
      }

      db.run('DELETE FROM maintenance_schedules WHERE id = ?', [scheduleId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async completeMaintenance(logId, completionData, userId) {
    return new Promise((resolve, reject) => {
      const { notes, parts_used, cost } = completionData;

      db.run(
        `UPDATE maintenance_logs SET
         performed_by = ?, end_time = ?, status = 'completed', notes = ?, parts_used = ?, cost = ?
         WHERE id = ?`,
        [userId, new Date().toISOString(), notes, parts_used, cost, logId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Get upcoming maintenance
  async getUpcomingMaintenance(days = 7) {
    return new Promise((resolve, reject) => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      db.all(
        `SELECT ms.*, a.name as asset_name, u.username as assigned_username
         FROM maintenance_schedules ms
         LEFT JOIN assets a ON ms.asset_id = a.id
         LEFT JOIN users u ON ms.assigned_to = u.id
         WHERE ms.is_active = 1 AND ms.next_run <= ?
         ORDER BY ms.next_run ASC`,
        [futureDate.toISOString()],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Get maintenance history
  async getMaintenanceHistory(assetId = null, limit = 50) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT ml.*, ms.title as schedule_title, a.name as asset_name, u.username as performed_by_username
        FROM maintenance_logs ml
        LEFT JOIN maintenance_schedules ms ON ml.schedule_id = ms.id
        LEFT JOIN assets a ON ml.asset_id = a.id
        LEFT JOIN users u ON ml.performed_by = u.id
      `;
      const params = [];

      if (assetId) {
        query += ' WHERE ml.asset_id = ?';
        params.push(assetId);
      }

      query += ' ORDER BY ml.start_time DESC LIMIT ?';
      params.push(limit);

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new MaintenanceService();
