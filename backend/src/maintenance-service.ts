import * as cron from 'node-cron';
import { query } from './database';
import notificationService from './notification-service';

interface MaintenanceSchedule {
  id: number;
  asset_id: number;
  title: string;
  description?: string;
  schedule_type: string;
  cron_expression?: string;
  next_run?: string;
  last_run?: string;
  is_active: boolean;
  priority: string;
  estimated_duration?: number;
  assigned_to?: number;
  created_by?: number;
  created_at: string;
  updated_at?: string;
}

interface MaintenanceLog {
  id: number;
  schedule_id?: number;
  asset_id: number;
  performed_by?: number;
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  parts_used?: string;
  cost?: number;
  created_at: string;
}

interface MaintenanceNotificationRecipient {
  id: number;
  email: string;
  phone?: string;
  email_notifications: boolean;
  sms_notifications: boolean;
}

interface CreateScheduleData {
  asset_id: number;
  title: string;
  description?: string;
  schedule_type: string;
  cron_expression?: string;
  priority?: string;
  estimated_duration?: number;
  assigned_to?: number;
}

interface UpdateScheduleData {
  asset_id?: number;
  title?: string;
  description?: string;
  schedule_type?: string;
  cron_expression?: string;
  priority?: string;
  estimated_duration?: number;
  assigned_to?: number;
  is_active?: boolean;
}

interface CompletionData {
  notes?: string;
  parts_used?: string;
  cost?: number;
}

class MaintenanceService {
  private scheduledJobs: Map<number, cron.ScheduledTask> = new Map();
  private io: any = null;

  setSocketIO(io: any): void {
    this.io = io;
  }

  async initialize(): Promise<void> {
    await this.loadActiveSchedules();
    console.log('Maintenance service initialized');
  }

  async loadActiveSchedules(): Promise<void> {
    const result = await query(
      'SELECT * FROM maintenance_schedules WHERE is_active = true',
      []
    );

    // Clear existing jobs
    this.scheduledJobs.forEach(job => job.destroy());
    this.scheduledJobs.clear();

    // Schedule new jobs
    result.rows.forEach((schedule: MaintenanceSchedule) => {
      this.scheduleMaintenanceJob(schedule);
    });

    console.log(`Loaded ${result.rows.length} active maintenance schedules`);
  }

  private scheduleMaintenanceJob(schedule: MaintenanceSchedule): void {
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

  private async executeMaintenance(schedule: MaintenanceSchedule): Promise<void> {
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

  private async createMaintenanceLog(schedule: MaintenanceSchedule): Promise<number> {
    const result = await query(
      `INSERT INTO maintenance_logs
       (schedule_id, asset_id, performed_by, status, start_time)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [schedule.id, schedule.asset_id, schedule.assigned_to, 'scheduled', new Date().toISOString()]
    );

    return result.rows[0].id;
  }

  private async updateScheduleLastRun(scheduleId: number): Promise<void> {
    await query(
      'UPDATE maintenance_schedules SET last_run = $1 WHERE id = $2',
      [new Date().toISOString(), scheduleId]
    );
  }

  private async notifyMaintenanceDue(schedule: MaintenanceSchedule): Promise<void> {
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

  private async getMaintenanceNotificationRecipients(schedule: MaintenanceSchedule): Promise<MaintenanceNotificationRecipient[]> {
    let queryText = 'SELECT id, email, phone, email_notifications, sms_notifications FROM users WHERE ';
    const params: any[] = [];

    if (schedule.assigned_to) {
      queryText += 'id = $1 OR role = $2';
      params.push(schedule.assigned_to, 'admin');
    } else {
      queryText += 'role IN ($1, $2)';
      params.push('admin', 'operator');
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  // CRUD operations for maintenance schedules
  async createSchedule(scheduleData: CreateScheduleData, userId: number): Promise<MaintenanceSchedule> {
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

    const result = await query(
      `INSERT INTO maintenance_schedules
       (asset_id, title, description, schedule_type, cron_expression, priority, estimated_duration, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [asset_id, title, description, schedule_type, cron_expression, priority || 'medium', estimated_duration, assigned_to, userId]
    );

    const newSchedule: MaintenanceSchedule = {
      id: result.rows[0].id,
      ...scheduleData,
      priority: priority || 'medium',
      created_by: userId,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Schedule the job
    this.scheduleMaintenanceJob(newSchedule);

    return newSchedule;
  }

  async updateSchedule(scheduleId: number, scheduleData: UpdateScheduleData): Promise<MaintenanceSchedule> {
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

    await query(
      `UPDATE maintenance_schedules SET
       asset_id = $1, title = $2, description = $3, schedule_type = $4, cron_expression = $5,
       priority = $6, estimated_duration = $7, assigned_to = $8, is_active = $9, updated_at = $10
       WHERE id = $11`,
      [asset_id, title, description, schedule_type, cron_expression, priority, estimated_duration, assigned_to, is_active, new Date().toISOString(), scheduleId]
    );

    // Reload schedules if this one was updated
    await this.loadActiveSchedules();

    return {
      id: scheduleId,
      ...scheduleData,
      created_at: new Date().toISOString() // This would be better retrieved from DB
    } as MaintenanceSchedule;
  }

  async deleteSchedule(scheduleId: number): Promise<void> {
    // Remove from scheduled jobs
    if (this.scheduledJobs.has(scheduleId)) {
      this.scheduledJobs.get(scheduleId)!.destroy();
      this.scheduledJobs.delete(scheduleId);
    }

    await query('DELETE FROM maintenance_schedules WHERE id = $1', [scheduleId]);
  }

  async completeMaintenance(logId: number, completionData: CompletionData, userId: number): Promise<void> {
    const { notes, parts_used, cost } = completionData;

    await query(
      `UPDATE maintenance_logs SET
       performed_by = $1, end_time = $2, status = $3, notes = $4, parts_used = $5, cost = $6
       WHERE id = $7`,
      [userId, new Date().toISOString(), 'completed', notes, parts_used, cost, logId]
    );
  }

  // Get upcoming maintenance
  async getUpcomingMaintenance(days: number = 7): Promise<any[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const result = await query(
      `SELECT ms.*, a.name as asset_name, u.username as assigned_username
       FROM maintenance_schedules ms
       LEFT JOIN assets a ON ms.asset_id = a.id
       LEFT JOIN users u ON ms.assigned_to = u.id
       WHERE ms.is_active = true AND ms.next_run <= $1
       ORDER BY ms.next_run ASC`,
      [futureDate.toISOString()]
    );

    return result.rows;
  }

  // Get maintenance history
  async getMaintenanceHistory(assetId: number | null = null, limit: number = 50): Promise<any[]> {
    let queryText = `
      SELECT ml.*, ms.title as schedule_title, a.name as asset_name, u.username as performed_by_username
      FROM maintenance_logs ml
      LEFT JOIN maintenance_schedules ms ON ml.schedule_id = ms.id
      LEFT JOIN assets a ON ml.asset_id = a.id
      LEFT JOIN users u ON ml.performed_by = u.id
    `;
    const params: any[] = [];

    if (assetId) {
      queryText += ' WHERE ml.asset_id = $1';
      params.push(assetId);
    }

    queryText += ' ORDER BY ml.start_time DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(queryText, params);
    return result.rows;
  }
}

const maintenanceService = new MaintenanceService();
export default maintenanceService;
