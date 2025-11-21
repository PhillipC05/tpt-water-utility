const nodemailer = require('nodemailer');
const twilio = require('twilio');
const db = require('./database');

class NotificationService {
  constructor() {
    // Email configuration
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
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
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendEmail(to, subject, text, html = null) {
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
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendSMS(to, message) {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to: to
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }
  }

  async notifyAlert(alertData) {
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
      const notifications = [];

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
    } catch (error) {
      console.error('Error sending alert notifications:', error);
      return { success: false, error: error.message };
    }
  }

  async getNotificationRecipients(severity) {
    return new Promise((resolve, reject) => {
      // Get users based on severity level
      let query = 'SELECT id, email, phone, email_notifications, sms_notifications FROM users WHERE ';
      const params = [];

      switch (severity) {
        case 'critical':
          query += 'role IN ("admin", "operator")';
          break;
        case 'high':
          query += 'role IN ("admin", "operator")';
          break;
        case 'medium':
          query += 'role = "admin"';
          break;
        case 'low':
          query += 'role = "admin"';
          break;
        default:
          query += 'role = "admin"';
      }

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async logNotifications(notifications) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO notification_logs
        (user_id, type, alert_id, success, message_id, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      let completed = 0;
      const total = notifications.length;

      if (total === 0) {
        resolve();
        return;
      }

      notifications.forEach(notification => {
        stmt.run([
          notification.user_id,
          notification.type,
          notification.alert_id,
          notification.success ? 1 : 0,
          notification.message_id,
          notification.error,
          new Date().toISOString()
        ], (err) => {
          if (err) {
            console.error('Error logging notification:', err);
          }
          completed++;
          if (completed === total) {
            stmt.finalize();
            resolve();
          }
        });
      });
    });
  }

  // Test notification methods
  async testEmail(email) {
    return this.sendEmail(
      email,
      'Water Utility - Email Test',
      'This is a test email from the Water Utility notification system.'
    );
  }

  async testSMS(phone) {
    return this.sendSMS(
      phone,
      'WATER UTILITY: This is a test SMS from the notification system.'
    );
  }
}

module.exports = new NotificationService();
