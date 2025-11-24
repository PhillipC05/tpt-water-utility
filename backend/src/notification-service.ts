import nodemailer, { Transporter } from 'nodemailer';
import twilio, { Twilio } from 'twilio';
import { query } from './database';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface NotificationRecipient {
  id: number;
  email: string;
  phone?: string;
  email_notifications: boolean;
  sms_notifications: boolean;
}

interface AlertData {
  id: number;
  type: string;
  severity: string;
  message: string;
  created_at: string;
}

interface NotificationLog {
  user_id: number;
  type: 'email' | 'sms';
  alert_id?: number;
  success: boolean;
  message_id?: string;
  error?: string;
}

class NotificationService {
  private emailTransporter: Transporter;
  private twilioClient: Twilio;
  private twilioPhoneNumber: string;

  constructor() {
    // Email configuration
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // SMS configuration
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: to,
        subject: subject,
        text: text,
        html: html || text
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendSMS(to: string, message: string): Promise<SMSResult> {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to: to
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }
  }

  async notifyAlert(alertData: AlertData): Promise<{ success: boolean; notifications?: NotificationLog[]; error?: string }> {
    try {
      // Get all users who should receive notifications
      const users = await this.getNotificationRecipients(alertData.severity);

      const subject = `Water Utility Alert: ${alertData.type.replace('_', ' ').toUpperCase()}`;
      const message = `
Alert Details:
Type: ${alertData.type}
Severity: ${alertData.severity}
Message: ${alertData.message}
Time: ${new Date(alertData.created_at).toLocaleString()}

Please check the system dashboard for more information.
      `.trim();

      // Send notifications to all recipients
      const notifications: NotificationLog[] = [];

      for (const user of users) {
        // Send email if user has email notifications enabled
        if (user.email_notifications) {
          const emailResult = await this.sendEmail(
            user.email,
            subject,
            message
          );
          notifications.push({
            user_id: user.id,
            type: 'email',
            alert_id: alertData.id,
            success: emailResult.success,
            message_id: emailResult.messageId,
            error: emailResult.error
          });
        }

        // Send SMS if user has SMS notifications enabled and phone number
        if (user.sms_notifications && user.phone) {
          const smsResult = await this.sendSMS(
            user.phone,
            `WATER UTILITY ALERT: ${alertData.message}`
          );
          notifications.push({
            user_id: user.id,
            type: 'sms',
            alert_id: alertData.id,
            success: smsResult.success,
            message_id: smsResult.messageId,
            error: smsResult.error
          });
        }
      }

      // Log notifications
      await this.logNotifications(notifications);

      return { success: true, notifications };
    } catch (error: any) {
      console.error('Error sending alert notifications:', error);
      return { success: false, error: error.message };
    }
  }

  async getNotificationRecipients(severity: string): Promise<NotificationRecipient[]> {
    let queryText = 'SELECT id, email, phone, email_notifications, sms_notifications FROM users WHERE ';
    const params: any[] = [];

    switch (severity) {
      case 'critical':
        queryText += 'role IN ($1, $2)';
        params.push('admin', 'operator');
        break;
      case 'high':
        queryText += 'role IN ($1, $2)';
        params.push('admin', 'operator');
        break;
      case 'medium':
        queryText += 'role = $1';
        params.push('admin');
        break;
      case 'low':
        queryText += 'role = $1';
        params.push('admin');
        break;
      default:
        queryText += 'role = $1';
        params.push('admin');
    }

    const result = await query(queryText, params);
    return result.rows;
  }

  async logNotifications(notifications: NotificationLog[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    const values = notifications.map((notification, index) => 
      `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
    ).join(', ');

    const params: any[] = [];
    notifications.forEach(notification => {
      params.push(
        notification.user_id,
        notification.type,
        notification.alert_id || null,
        notification.success,
        notification.message_id || null,
        notification.error || null,
        new Date().toISOString()
      );
    });

    const queryText = `
      INSERT INTO notification_logs
      (user_id, type, alert_id, success, message_id, error, created_at)
      VALUES ${values}
    `;

    try {
      await query(queryText, params);
    } catch (error) {
      console.error('Error logging notifications:', error);
    }
  }

  // Test notification methods
  async testEmail(email: string): Promise<EmailResult> {
    return this.sendEmail(
      email,
      'Water Utility - Email Test',
      'This is a test email from the Water Utility notification system.'
    );
  }

  async testSMS(phone: string): Promise<SMSResult> {
    return this.sendSMS(
      phone,
      'WATER UTILITY: This is a test SMS from the notification system.'
    );
  }
}

const notificationService = new NotificationService();
export default notificationService;
