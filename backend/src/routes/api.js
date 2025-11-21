const express = require('express');
const db = require('../database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all sensors
router.get('/sensors', authenticateToken, (req, res) => {
  db.all('SELECT * FROM sensors ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

// Add sensor
router.post('/sensors', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { name, type, location } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  db.run(
    'INSERT INTO sensors (name, type, location) VALUES (?, ?, ?)',
    [name, type, location],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Sensor added successfully' });
    }
  );
});

// Get sensor readings
router.get('/sensors/:id/readings', authenticateToken, (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit || 100;

  db.all(
    'SELECT * FROM readings WHERE sensor_id = ? ORDER BY timestamp DESC LIMIT ?',
    [id, limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// Add reading
router.post('/readings', authenticateToken, (req, res) => {
  const { sensor_id, value, unit } = req.body;

  if (!sensor_id || value === undefined) {
    return res.status(400).json({ message: 'Sensor ID and value are required' });
  }

  db.run(
    'INSERT INTO readings (sensor_id, value, unit) VALUES (?, ?, ?)',
    [sensor_id, value, unit],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }

      // Update sensor last reading
      db.run(
        'UPDATE sensors SET last_reading = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [value, sensor_id]
      );

      res.status(201).json({ id: this.lastID, message: 'Reading added successfully' });
    }
  );
});

// Get assets
router.get('/assets', authenticateToken, (req, res) => {
  db.all('SELECT * FROM assets ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

// Add asset
router.post('/assets', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { name, type, location, installation_date } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  db.run(
    'INSERT INTO assets (name, type, location, installation_date) VALUES (?, ?, ?, ?)',
    [name, type, location, installation_date],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Asset added successfully' });
    }
  );
});

// Get compliance standards
router.get('/compliance', authenticateToken, (req, res) => {
  db.all('SELECT * FROM compliance_standards ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

// Treatment processes
router.get('/treatment', authenticateToken, (req, res) => {
  db.all('SELECT * FROM treatment_processes ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/treatment', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { name, type, capacity, unit, location } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  db.run(
    'INSERT INTO treatment_processes (name, type, capacity, unit, location) VALUES (?, ?, ?, ?, ?)',
    [name, type, capacity, unit, location],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Treatment process added successfully' });
    }
  );
});

// Pumps
router.get('/pumps', authenticateToken, (req, res) => {
  db.all('SELECT * FROM pumps ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/pumps', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { name, type, location, flow_rate, pressure, power_consumption } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  db.run(
    'INSERT INTO pumps (name, type, location, flow_rate, pressure, power_consumption) VALUES (?, ?, ?, ?, ?, ?)',
    [name, type, location, flow_rate, pressure, power_consumption],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Pump added successfully' });
    }
  );
});

// Water quality
router.get('/water-quality', authenticateToken, (req, res) => {
  db.all('SELECT * FROM water_quality ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/water-quality', authenticateToken, (req, res) => {
  const { location, ph, turbidity, chlorine, conductivity, temperature } = req.body;

  if (!location) {
    return res.status(400).json({ message: 'Location is required' });
  }

  db.run(
    'INSERT INTO water_quality (location, ph, turbidity, chlorine, conductivity, temperature) VALUES (?, ?, ?, ?, ?, ?)',
    [location, ph, turbidity, chlorine, conductivity, temperature],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Water quality reading added successfully' });
    }
  );
});

// Alerts
router.get('/alerts', authenticateToken, (req, res) => {
  db.all('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/alerts', authenticateToken, (req, res) => {
  const { type, message, severity = 'medium', sensor_id } = req.body;

  if (!type || !message) {
    return res.status(400).json({ message: 'Type and message are required' });
  }

  db.run(
    'INSERT INTO alerts (type, message, severity, sensor_id) VALUES (?, ?, ?, ?)',
    [type, message, severity, sensor_id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Alert created successfully' });
    }
  );
});

// IoT endpoints
router.get('/iot/status', authenticateToken, (req, res) => {
  const iotService = require('../iot-service');
  res.json(iotService.getStatus());
});

router.post('/iot/command', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { topic, command } = req.body;
  const iotService = require('../iot-service');

  if (!topic || !command) {
    return res.status(400).json({ message: 'Topic and command are required' });
  }

  iotService.publishCommand(topic, command);
  res.json({ message: 'Command sent successfully' });
});

// Notification endpoints
router.post('/notifications/test-email', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { email } = req.body;
  const notificationService = require('../notification-service');

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  notificationService.testEmail(email).then(result => {
    if (result.success) {
      res.json({ message: 'Test email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ message: 'Failed to send test email', error: result.error });
    }
  });
});

router.post('/notifications/test-sms', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { phone } = req.body;
  const notificationService = require('../notification-service');

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  notificationService.testSMS(phone).then(result => {
    if (result.success) {
      res.json({ message: 'Test SMS sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ message: 'Failed to send test SMS', error: result.error });
    }
  });
});

// User management endpoints
router.get('/users', authenticateToken, authorizeRoles('admin'), (req, res) => {
  db.all('SELECT id, username, email, role, phone, email_notifications, sms_notifications, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/users', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { username, email, password, role, phone, email_notifications, sms_notifications } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, email, password, role, phone, email_notifications, sms_notifications) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, email, hashedPassword, role || 'operator', phone, email_notifications !== undefined ? email_notifications : true, sms_notifications || false],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'User created successfully' });
    }
  );
});

router.put('/users/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { id } = req.params;
  const { username, email, role, phone, email_notifications, sms_notifications } = req.body;

  db.run(
    'UPDATE users SET username = ?, email = ?, role = ?, phone = ?, email_notifications = ?, sms_notifications = ? WHERE id = ?',
    [username, email, role, phone, email_notifications, sms_notifications, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json({ message: 'User updated successfully' });
    }
  );
});

router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

// Maintenance endpoints
router.get('/maintenance/schedules', authenticateToken, (req, res) => {
  const maintenanceService = require('../maintenance-service');

  db.all(
    `SELECT ms.*, a.name as asset_name, u.username as assigned_username, cu.username as created_username
     FROM maintenance_schedules ms
     LEFT JOIN assets a ON ms.asset_id = a.id
     LEFT JOIN users u ON ms.assigned_to = u.id
     LEFT JOIN users cu ON ms.created_by = cu.id
     ORDER BY ms.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(rows);
    }
  );
});

router.post('/maintenance/schedules', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const maintenanceService = require('../maintenance-service');
  const userId = req.user.id;

  maintenanceService.createSchedule(req.body, userId).then(schedule => {
    res.status(201).json(schedule);
  }).catch(error => {
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ message: 'Failed to create maintenance schedule' });
  });
});

router.put('/maintenance/schedules/:id', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const maintenanceService = require('../maintenance-service');
  const { id } = req.params;

  maintenanceService.updateSchedule(id, req.body).then(schedule => {
    res.json(schedule);
  }).catch(error => {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ message: 'Failed to update maintenance schedule' });
  });
});

router.delete('/maintenance/schedules/:id', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const maintenanceService = require('../maintenance-service');
  const { id } = req.params;

  maintenanceService.deleteSchedule(id).then(() => {
    res.json({ message: 'Maintenance schedule deleted successfully' });
  }).catch(error => {
    console.error('Error deleting maintenance schedule:', error);
    res.status(500).json({ message: 'Failed to delete maintenance schedule' });
  });
});

router.get('/maintenance/upcoming', authenticateToken, (req, res) => {
  const maintenanceService = require('../maintenance-service');
  const days = req.query.days || 7;

  maintenanceService.getUpcomingMaintenance(parseInt(days)).then(schedules => {
    res.json(schedules);
  }).catch(error => {
    console.error('Error fetching upcoming maintenance:', error);
    res.status(500).json({ message: 'Failed to fetch upcoming maintenance' });
  });
});

router.get('/maintenance/history', authenticateToken, (req, res) => {
  const maintenanceService = require('../maintenance-service');
  const assetId = req.query.asset_id;
  const limit = req.query.limit || 50;

  maintenanceService.getMaintenanceHistory(assetId, parseInt(limit)).then(history => {
    res.json(history);
  }).catch(error => {
    console.error('Error fetching maintenance history:', error);
    res.status(500).json({ message: 'Failed to fetch maintenance history' });
  });
});

router.post('/maintenance/complete/:logId', authenticateToken, (req, res) => {
  const maintenanceService = require('../maintenance-service');
  const { logId } = req.params;
  const userId = req.user.id;

  maintenanceService.completeMaintenance(logId, req.body, userId).then(() => {
    res.json({ message: 'Maintenance completed successfully' });
  }).catch(error => {
    console.error('Error completing maintenance:', error);
    res.status(500).json({ message: 'Failed to complete maintenance' });
  });
});

// SCADA integration endpoints
router.get('/scada/status', authenticateToken, (req, res) => {
  // Mock SCADA status - in real implementation, this would connect to actual SCADA system
  res.json({
    connected: true,
    systems: [
      { name: 'Main Control System', status: 'operational', last_sync: new Date().toISOString() },
      { name: 'Backup Control System', status: 'standby', last_sync: new Date().toISOString() }
    ]
  });
});

router.post('/scada/control/:deviceId', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { deviceId } = req.params;
  const { command, parameters } = req.body;

  // Mock SCADA control - in real implementation, this would send commands to SCADA system
  console.log(`SCADA command for device ${deviceId}:`, command, parameters);

  res.json({
    success: true,
    device_id: deviceId,
    command: command,
    executed_at: new Date().toISOString()
  });
});

// Audit endpoints
router.get('/audit/logs', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const auditService = require('../audit-service');
  const { event_type, sub_event, user_id, start_date, end_date, limit, offset } = req.query;

  const filters = {};
  if (event_type) filters.event_type = event_type;
  if (sub_event) filters.sub_event = sub_event;
  if (user_id) filters.user_id = user_id;
  if (start_date) filters.start_date = start_date;
  if (end_date) filters.end_date = end_date;

  auditService.queryLogs(filters, parseInt(limit) || 100, parseInt(offset) || 0)
    .then(logs => res.json(logs))
    .catch(error => {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    });
});

router.get('/audit/stats', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const auditService = require('../audit-service');
  const days = req.query.days || 30;

  auditService.getAuditStats(parseInt(days))
    .then(stats => res.json(stats))
    .catch(error => {
      console.error('Error fetching audit stats:', error);
      res.status(500).json({ message: 'Failed to fetch audit statistics' });
    });
});

router.post('/audit/cleanup', authenticateToken, authorizeRoles('admin'), (req, res) => {
  const auditService = require('../audit-service');
  const daysToKeep = req.body.daysToKeep || 90;

  auditService.cleanupOldLogs(daysToKeep)
    .then(deletedCount => res.json({ message: `Cleaned up ${deletedCount} old audit logs` }))
    .catch(error => {
      console.error('Error cleaning up audit logs:', error);
      res.status(500).json({ message: 'Failed to cleanup audit logs' });
    });
});

// Customer Management endpoints
router.get('/customers', authenticateToken, (req, res) => {
  const { search, status, service_type } = req.query;
  let query = 'SELECT * FROM customers WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (customer_name ILIKE ? OR account_number ILIKE ? OR service_address ILIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    query += ' AND account_status = ?';
    params.push(status);
  }

  if (service_type) {
    query += ' AND service_type = ?';
    params.push(service_type);
  }

  query += ' ORDER BY customer_name';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/customers', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const {
    account_number,
    customer_name,
    service_address,
    mailing_address,
    phone,
    email,
    service_type,
    meter_number,
    meter_size,
    installation_date
  } = req.body;

  if (!account_number || !customer_name || !service_address) {
    return res.status(400).json({ message: 'Account number, customer name, and service address are required' });
  }

  db.run(
    `INSERT INTO customers
     (account_number, customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [account_number, customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Customer created successfully' });
    }
  );
});

// Meter Readings endpoints
router.get('/meter-readings', authenticateToken, (req, res) => {
  const { customer_id, start_date, end_date } = req.query;
  let query = 'SELECT mr.*, c.customer_name FROM meter_readings mr JOIN customers c ON mr.customer_id = c.id WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND mr.customer_id = ?';
    params.push(customer_id);
  }

  if (start_date) {
    query += ' AND mr.reading_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND mr.reading_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY mr.reading_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/meter-readings', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { customer_id, meter_number, reading_date, reading_value, reading_type, units, notes } = req.body;

  if (!customer_id || !meter_number || !reading_date || reading_value === undefined) {
    return res.status(400).json({ message: 'Customer ID, meter number, reading date, and value are required' });
  }

  db.run(
    `INSERT INTO meter_readings
     (customer_id, meter_number, reading_date, reading_value, reading_type, units, recorded_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, meter_number, reading_date, reading_value, reading_type, units, req.user.id, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Meter reading recorded successfully' });
    }
  );
});

// Billing endpoints
router.get('/bills', authenticateToken, (req, res) => {
  const { customer_id, status, start_date, end_date } = req.query;
  let query = 'SELECT b.*, c.customer_name, c.account_number FROM bills b JOIN customers c ON b.customer_id = c.id WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND b.customer_id = ?';
    params.push(customer_id);
  }

  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }

  if (start_date) {
    query += ' AND b.service_period_start >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND b.service_period_end <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY b.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/bills', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const {
    customer_id,
    billing_cycle_id,
    bill_number,
    service_period_start,
    service_period_end,
    previous_reading,
    current_reading,
    consumption,
    base_charge,
    consumption_charge,
    sewer_charge,
    stormwater_charge,
    other_charges,
    total_amount,
    due_date
  } = req.body;

  if (!customer_id || !bill_number || !service_period_start || !service_period_end || !total_amount || !due_date) {
    return res.status(400).json({ message: 'Required fields: customer_id, bill_number, service_period_start, service_period_end, total_amount, due_date' });
  }

  db.run(
    `INSERT INTO bills
     (customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Bill created successfully' });
    }
  );
});

// Service Requests endpoints
router.get('/service-requests', authenticateToken, (req, res) => {
  const { customer_id, status, priority } = req.query;
  let query = 'SELECT sr.*, c.customer_name FROM service_requests sr JOIN customers c ON sr.customer_id = c.id WHERE 1=1';
  const params = [];

  if (customer_id) {
    query += ' AND sr.customer_id = ?';
    params.push(customer_id);
  }

  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }

  if (priority) {
    query += ' AND sr.priority = ?';
    params.push(priority);
  }

  query += ' ORDER BY sr.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/service-requests', authenticateToken, (req, res) => {
  const {
    customer_id,
    request_type,
    priority,
    description,
    service_address,
    contact_name,
    contact_phone,
    contact_email
  } = req.body;

  if (!customer_id || !request_type || !description) {
    return res.status(400).json({ message: 'Customer ID, request type, and description are required' });
  }

  db.run(
    `INSERT INTO service_requests
     (customer_id, request_type, priority, description, service_address, contact_name, contact_phone, contact_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, request_type, priority, description, service_address, contact_name, contact_phone, contact_email],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Service request created successfully' });
    }
  );
});

// Work Orders endpoints
router.get('/work-orders', authenticateToken, (req, res) => {
  const { status, assigned_to, priority } = req.query;
  let query = `SELECT wo.*, sr.description as service_request_description, c.customer_name,
                      u.username as assigned_username, cu.username as created_username
               FROM work_orders wo
               LEFT JOIN service_requests sr ON wo.service_request_id = sr.id
               LEFT JOIN customers c ON sr.customer_id = c.id
               LEFT JOIN users u ON wo.assigned_to = u.id
               LEFT JOIN users cu ON wo.created_by = cu.id
               WHERE 1=1`;
  const params = [];

  if (status) {
    query += ' AND wo.status = ?';
    params.push(status);
  }

  if (assigned_to) {
    query += ' AND wo.assigned_to = ?';
    params.push(assigned_to);
  }

  if (priority) {
    query += ' AND wo.priority = ?';
    params.push(priority);
  }

  query += ' ORDER BY wo.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/work-orders', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const {
    service_request_id,
    work_order_number,
    title,
    description,
    priority,
    assigned_to,
    scheduled_date,
    estimated_hours,
    estimated_cost,
    location
  } = req.body;

  if (!work_order_number || !title) {
    return res.status(400).json({ message: 'Work order number and title are required' });
  }

  db.run(
    `INSERT INTO work_orders
     (service_request_id, work_order_number, title, description, priority, assigned_to, scheduled_date, estimated_hours, estimated_cost, location, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [service_request_id, work_order_number, title, description, priority, assigned_to, scheduled_date, estimated_hours, estimated_cost, location, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Work order created successfully' });
    }
  );
});

// Leak Detection endpoints
router.get('/leak-detection', authenticateToken, (req, res) => {
  const { status, severity } = req.query;
  let query = 'SELECT ld.*, u.username as reported_by_username FROM leak_detection ld LEFT JOIN users u ON ld.reported_by = u.id WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND ld.status = ?';
    params.push(status);
  }

  if (severity) {
    query += ' AND ld.severity = ?';
    params.push(severity);
  }

  query += ' ORDER BY ld.detected_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/leak-detection', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const { location, leak_type, severity, estimated_loss_gpd, coordinates } = req.body;

  if (!location) {
    return res.status(400).json({ message: 'Location is required' });
  }

  db.run(
    `INSERT INTO leak_detection
     (location, leak_type, severity, reported_by, estimated_loss_gpd, coordinates)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [location, leak_type, severity, req.user.id, estimated_loss_gpd, coordinates],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Leak detection report created successfully' });
    }
  );
});

// Energy Consumption endpoints
router.get('/energy-consumption', authenticateToken, (req, res) => {
  const { asset_id, start_date, end_date } = req.query;
  let query = 'SELECT ec.*, a.name as asset_name, u.username as recorded_by_username FROM energy_consumption ec LEFT JOIN assets a ON ec.asset_id = a.id LEFT JOIN users u ON ec.recorded_by = u.id WHERE 1=1';
  const params = [];

  if (asset_id) {
    query += ' AND ec.asset_id = ?';
    params.push(asset_id);
  }

  if (start_date) {
    query += ' AND ec.measurement_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND ec.measurement_date <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY ec.measurement_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/energy-consumption', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const {
    asset_id,
    facility_name,
    measurement_date,
    electricity_kwh,
    electricity_cost,
    natural_gas_therms,
    natural_gas_cost,
    diesel_gallons,
    diesel_cost,
    notes
  } = req.body;

  if (!facility_name || !measurement_date) {
    return res.status(400).json({ message: 'Facility name and measurement date are required' });
  }

  const total_cost = (electricity_cost || 0) + (natural_gas_cost || 0) + (diesel_cost || 0);

  db.run(
    `INSERT INTO energy_consumption
     (asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, total_cost, recorded_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, total_cost, req.user.id, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Energy consumption recorded successfully' });
    }
  );
});

// Regulatory Compliance endpoints
router.get('/regulatory-compliance', authenticateToken, (req, res) => {
  const { status, regulation_type } = req.query;
  let query = 'SELECT rc.*, u.username as responsible_username FROM regulatory_compliance rc LEFT JOIN users u ON rc.responsible_party = u.id WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND rc.status = ?';
    params.push(status);
  }

  if (regulation_type) {
    query += ' AND rc.regulation_type = ?';
    params.push(regulation_type);
  }

  query += ' ORDER BY rc.next_due_date ASC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(rows);
  });
});

router.post('/regulatory-compliance', authenticateToken, authorizeRoles('admin', 'operator'), (req, res) => {
  const {
    regulation_name,
    regulation_type,
    description,
    compliance_date,
    next_due_date,
    status,
    responsible_party,
    documentation_path,
    notes
  } = req.body;

  if (!regulation_name || !regulation_type) {
    return res.status(400).json({ message: 'Regulation name and type are required' });
  }

  db.run(
    `INSERT INTO regulatory_compliance
     (regulation_name, regulation_type, description, compliance_date, next_due_date, status, responsible_party, documentation_path, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [regulation_name, regulation_type, description, compliance_date, next_due_date, status, responsible_party, documentation_path, notes],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Regulatory compliance record created successfully' });
    }
  );
});

module.exports = router;
