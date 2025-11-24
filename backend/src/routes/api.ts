import express, { Request, Response, Router } from 'express';
import { query } from '../database';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

// User interface is already declared in middleware/auth.ts

// Type definitions for API requests and responses
interface SensorRequest {
  name: string;
  type: string;
  location?: string;
}

interface ReadingRequest {
  sensor_id: number;
  value: number;
  unit?: string;
}

interface AssetRequest {
  name: string;
  type: string;
  location?: string;
  installation_date?: string;
}

interface TreatmentRequest {
  name: string;
  type: string;
  capacity?: number;
  unit?: string;
  location?: string;
}

interface PumpRequest {
  name: string;
  type: string;
  location?: string;
  flow_rate?: number;
  pressure?: number;
  power_consumption?: number;
}

interface WaterQualityRequest {
  location: string;
  ph?: number;
  turbidity?: number;
  chlorine?: number;
  conductivity?: number;
  temperature?: number;
}

interface AlertRequest {
  type: string;
  message: string;
  severity?: string;
  sensor_id?: number;
}

interface IotCommandRequest {
  topic: string;
  command: string;
}

interface NotificationTestRequest {
  email?: string;
  phone?: string;
}

interface UserRequest {
  username: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
}

interface UserUpdateRequest {
  username?: string;
  email?: string;
  role?: string;
  phone?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
}

interface MaintenanceScheduleRequest {
  asset_id: number;
  title: string;
  description?: string;
  schedule_type: string;
  cron_expression?: string;
  priority?: string;
  estimated_duration?: number;
  assigned_to?: number;
}

interface ScadaControlRequest {
  command: string;
  parameters?: any;
}

interface AuditQueryRequest {
  event_type?: string;
  sub_event?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: string;
  offset?: string;
}

interface AuditCleanupRequest {
  daysToKeep?: number;
}

interface CustomerRequest {
  account_number: string;
  customer_name: string;
  service_address: string;
  mailing_address?: string;
  phone?: string;
  email?: string;
  service_type?: string;
  meter_number?: string;
  meter_size?: string;
  installation_date?: string;
}

interface MeterReadingRequest {
  customer_id: number;
  meter_number: string;
  reading_date: string;
  reading_value: number;
  reading_type?: string;
  units?: string;
  notes?: string;
}

interface BillRequest {
  customer_id: number;
  billing_cycle_id?: number;
  bill_number: string;
  service_period_start: string;
  service_period_end: string;
  previous_reading?: number;
  current_reading?: number;
  consumption?: number;
  base_charge?: number;
  consumption_charge?: number;
  sewer_charge?: number;
  stormwater_charge?: number;
  other_charges?: number;
  total_amount: number;
  due_date: string;
}

interface ServiceRequestRequest {
  customer_id: number;
  request_type: string;
  priority?: string;
  description: string;
  service_address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

interface WorkOrderRequest {
  service_request_id?: number;
  work_order_number: string;
  title: string;
  description?: string;
  priority?: string;
  assigned_to?: number;
  scheduled_date?: string;
  estimated_hours?: number;
  estimated_cost?: number;
  location?: string;
}

interface LeakDetectionRequest {
  location: string;
  leak_type?: string;
  severity?: string;
  estimated_loss_gpd?: number;
  coordinates?: any;
}

interface EnergyConsumptionRequest {
  asset_id?: number;
  facility_name: string;
  measurement_date: string;
  electricity_kwh?: number;
  electricity_cost?: number;
  natural_gas_therms?: number;
  natural_gas_cost?: number;
  diesel_gallons?: number;
  diesel_cost?: number;
  notes?: string;
}

interface RegulatoryComplianceRequest {
  regulation_name: string;
  regulation_type: string;
  description?: string;
  compliance_date?: string;
  next_due_date?: string;
  status?: string;
  responsible_party?: number;
  documentation_path?: string;
  notes?: string;
}

const router: Router = express.Router();

// Get all sensors
router.get('/sensors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM sensors ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Add sensor
router.post('/sensors', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, SensorRequest>, res: Response) => {
  const { name, type, location } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  try {
    const result = await query(
      'INSERT INTO sensors (name, type, location) VALUES ($1, $2, $3) RETURNING id',
      [name, type, location]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Sensor added successfully' });
  } catch (error) {
    console.error('Error adding sensor:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Get sensor readings
router.get('/sensors/:id/readings', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const limit = req.query.limit || 100;

  try {
    const result = await query(
      'SELECT * FROM readings WHERE sensor_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [id, limit]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sensor readings:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Add reading
router.post('/readings', authenticateToken, async (req: Request<{}, {}, ReadingRequest>, res: Response) => {
  const { sensor_id, value, unit } = req.body;

  if (!sensor_id || value === undefined) {
    return res.status(400).json({ message: 'Sensor ID and value are required' });
  }

  try {
    const insertResult = await query(
      'INSERT INTO readings (sensor_id, value, unit) VALUES ($1, $2, $3) RETURNING id',
      [sensor_id, value, unit]
    );

    // Update sensor last reading
    await query(
      'UPDATE sensors SET last_reading = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2',
      [value, sensor_id]
    );

    res.status(201).json({ id: insertResult.rows[0].id, message: 'Reading added successfully' });
  } catch (error) {
    console.error('Error adding reading:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Get assets
router.get('/assets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM assets ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Add asset
router.post('/assets', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, AssetRequest>, res: Response) => {
  const { name, type, location, installation_date } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  try {
    const result = await query(
      'INSERT INTO assets (name, type, location, installation_date) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, type, location, installation_date]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Asset added successfully' });
  } catch (error) {
    console.error('Error adding asset:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Get compliance standards
router.get('/compliance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM compliance_standards ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching compliance standards:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// Treatment processes
router.get('/treatment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM treatment_processes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching treatment processes:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/treatment', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, TreatmentRequest>, res: Response) => {
  const { name, type, capacity, unit, location } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  try {
    const result = await query(
      'INSERT INTO treatment_processes (name, type, capacity, unit, location) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, type, capacity, unit, location]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Treatment process added successfully' });
  } catch (error) {
    console.error('Error adding treatment process:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Pumps
router.get('/pumps', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM pumps ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pumps:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/pumps', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, PumpRequest>, res: Response) => {
  const { name, type, location, flow_rate, pressure, power_consumption } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  try {
    const result = await query(
      'INSERT INTO pumps (name, type, location, flow_rate, pressure, power_consumption) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, type, location, flow_rate, pressure, power_consumption]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Pump added successfully' });
  } catch (error) {
    console.error('Error adding pump:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Water quality
router.get('/water-quality', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM water_quality ORDER BY timestamp DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching water quality data:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/water-quality', authenticateToken, async (req: Request<{}, {}, WaterQualityRequest>, res: Response) => {
  const { location, ph, turbidity, chlorine, conductivity, temperature } = req.body;

  if (!location) {
    return res.status(400).json({ message: 'Location is required' });
  }

  try {
    const result = await query(
      'INSERT INTO water_quality (location, ph, turbidity, chlorine, conductivity, temperature) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [location, ph, turbidity, chlorine, conductivity, temperature]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Water quality reading added successfully' });
  } catch (error) {
    console.error('Error adding water quality reading:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Alerts
router.get('/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/alerts', authenticateToken, async (req: Request<{}, {}, AlertRequest>, res: Response) => {
  const { type, message, severity = 'medium', sensor_id } = req.body;

  if (!type || !message) {
    return res.status(400).json({ message: 'Type and message are required' });
  }

  try {
    const result = await query(
      'INSERT INTO alerts (type, message, severity, sensor_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [type, message, severity, sensor_id]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Alert created successfully' });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// IoT commands
router.post('/iot/command', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, IotCommandRequest>, res: Response) => {
  const { topic, command } = req.body;

  if (!topic || !command) {
    return res.status(400).json({ message: 'Topic and command are required' });
  }

  try {
    // Import IoT service dynamically to avoid circular dependencies
    const iotService = (await import('../iot-service')).default;
    iotService.publishCommand(topic, { command, timestamp: new Date().toISOString() });
    res.json({ message: 'IoT command sent successfully' });
  } catch (error) {
    console.error('Error sending IoT command:', error);
    res.status(500).json({ message: 'Failed to send IoT command' });
  }
});

// Notification test
router.post('/notifications/test', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, NotificationTestRequest>, res: Response) => {
  const { email, phone } = req.body;

  try {
    const notificationService = (await import('../notification-service')).default;

    if (email) {
      await notificationService.sendEmail(email, 'Test Notification', 'This is a test notification from the water utility system.');
    }

    if (phone) {
      await notificationService.sendSMS(phone, 'TEST: This is a test SMS from the water utility system.');
    }

    res.json({ message: 'Test notifications sent successfully' });
  } catch (error) {
    console.error('Error sending test notifications:', error);
    res.status(500).json({ message: 'Failed to send test notifications' });
  }
});

// User management
router.get('/users', authenticateToken, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT id, username, email, role, phone, email_notifications, sms_notifications, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/users', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, UserRequest>, res: Response) => {
  const { username, email, password, role = 'operator', phone, email_notifications = true, sms_notifications = false } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO users (username, email, password, role, phone, email_notifications, sms_notifications) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [username, email, hashedPassword, role, phone, email_notifications, sms_notifications]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/users/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }, {}, UserUpdateRequest>, res: Response) => {
  const { id } = req.params;
  const { username, email, role, phone, email_notifications, sms_notifications } = req.body;

  try {
    const result = await query(
      'UPDATE users SET username = $1, email = $2, role = $3, phone = $4, email_notifications = $5, sms_notifications = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
      [username, email, role, phone, email_notifications, sms_notifications, id]
    );
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Maintenance schedules
router.get('/maintenance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM maintenance_schedules ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/maintenance', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, MaintenanceScheduleRequest>, res: Response) => {
  const { asset_id, title, description, schedule_type, cron_expression, priority = 'medium', estimated_duration, assigned_to } = req.body;

  if (!asset_id || !title || !schedule_type) {
    return res.status(400).json({ message: 'Asset ID, title, and schedule type are required' });
  }

  try {
    const maintenanceService = (await import('../maintenance-service')).default;
    const schedule = await maintenanceService.createSchedule(req.body, req.user!.id);
    res.status(201).json(schedule);
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.put('/maintenance/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }, {}, Partial<MaintenanceScheduleRequest>>, res: Response) => {
  const { id } = req.params;

  try {
    const maintenanceService = (await import('../maintenance-service')).default;
    const schedule = await maintenanceService.updateSchedule(Number(id), req.body);
    res.json(schedule);
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/maintenance/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  try {
    const maintenanceService = (await import('../maintenance-service')).default;
    await maintenanceService.deleteSchedule(Number(id));
    res.json({ message: 'Maintenance schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance schedule:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// SCADA control
router.post('/scada/control', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, ScadaControlRequest>, res: Response) => {
  const { command, parameters } = req.body;

  if (!command) {
    return res.status(400).json({ message: 'Command is required' });
  }

  try {
    // Log SCADA command
    const auditService = (await import('../audit-service')).default;
    auditService.logSystemEvent('scada_command', { command, parameters, userId: req.user!.id });

    // Here you would integrate with actual SCADA system
    res.json({ message: 'SCADA command executed successfully', command, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error executing SCADA command:', error);
    res.status(500).json({ message: 'Failed to execute SCADA command' });
  }
});

// Audit logs
router.get('/audit', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, {}, AuditQueryRequest>, res: Response) => {
  const { event_type, sub_event, user_id, start_date, end_date, limit = '100', offset = '0' } = req.query;

  try {
    let queryText = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (event_type) {
      queryText += ` AND event_type = $${paramIndex}`;
      params.push(event_type);
      paramIndex++;
    }

    if (sub_event) {
      queryText += ` AND sub_event = $${paramIndex}`;
      params.push(sub_event);
      paramIndex++;
    }

    if (user_id) {
      queryText += ` AND user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (start_date) {
      queryText += ` AND timestamp >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      queryText += ` AND timestamp <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    queryText += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/audit/cleanup', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, AuditCleanupRequest>, res: Response) => {
  const { daysToKeep = 90 } = req.body;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await query('DELETE FROM audit_logs WHERE timestamp < $1', [cutoffDate.toISOString()]);

    res.json({ message: `Cleaned up ${result.rowCount} audit log entries` });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Customer management
router.get('/customers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/customers', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, CustomerRequest>, res: Response) => {
  const { account_number, customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date } = req.body;

  if (!account_number || !customer_name || !service_address) {
    return res.status(400).json({ message: 'Account number, customer name, and service address are required' });
  }

  try {
    const result = await query(
      'INSERT INTO customers (account_number, customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [account_number, customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Customer added successfully' });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Meter readings
router.get('/meter-readings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM meter_readings ORDER BY reading_date DESC LIMIT 1000');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meter readings:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/meter-readings', authenticateToken, async (req: Request<{}, {}, MeterReadingRequest>, res: Response) => {
  const { customer_id, meter_number, reading_date, reading_value, reading_type = 'regular', units = 'gallons', notes } = req.body;

  if (!customer_id || !meter_number || !reading_date || reading_value === undefined) {
    return res.status(400).json({ message: 'Customer ID, meter number, reading date, and reading value are required' });
  }

  try {
    const result = await query(
      'INSERT INTO meter_readings (customer_id, meter_number, reading_date, reading_value, reading_type, units, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [customer_id, meter_number, reading_date, reading_value, reading_type, units, notes]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Meter reading added successfully' });
  } catch (error) {
    console.error('Error adding meter reading:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Billing
router.get('/bills', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM bills ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/bills', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, BillRequest>, res: Response) => {
  const { customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date } = req.body;

  if (!customer_id || !bill_number || !service_period_start || !service_period_end || !total_amount || !due_date) {
    return res.status(400).json({ message: 'Customer ID, bill number, service period, total amount, and due date are required' });
  }

  try {
    const result = await query(
      'INSERT INTO bills (customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id',
      [customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Bill created successfully' });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Service requests
router.get('/service-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM service_requests ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service requests:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/service-requests', authenticateToken, async (req: Request<{}, {}, ServiceRequestRequest>, res: Response) => {
  const { customer_id, request_type, priority = 'medium', description, service_address, contact_name, contact_phone, contact_email } = req.body;

  if (!customer_id || !request_type || !description) {
    return res.status(400).json({ message: 'Customer ID, request type, and description are required' });
  }

  try {
    const result = await query(
      'INSERT INTO service_requests (customer_id, request_type, priority, description, service_address, contact_name, contact_phone, contact_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [customer_id, request_type, priority, description, service_address, contact_name, contact_phone, contact_email]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Service request created successfully' });
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Work orders
router.get('/work-orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM work_orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/work-orders', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, WorkOrderRequest>, res: Response) => {
  const { service_request_id, work_order_number, title, description, priority = 'medium', assigned_to, scheduled_date, estimated_hours, estimated_cost, location } = req.body;

  if (!work_order_number || !title) {
    return res.status(400).json({ message: 'Work order number and title are required' });
  }

  try {
    const result = await query(
      'INSERT INTO work_orders (service_request_id, work_order_number, title, description, priority, assigned_to, scheduled_date, estimated_hours, estimated_cost, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [service_request_id, work_order_number, title, description, priority, assigned_to, scheduled_date, estimated_hours, estimated_cost, location]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Work order created successfully' });
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Leak detection
router.get('/leaks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM leak_detections ORDER BY detected_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leak detections:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/leaks', authenticateToken, async (req: Request<{}, {}, LeakDetectionRequest>, res: Response) => {
  const { location, leak_type = 'unknown', severity = 'low', estimated_loss_gpd, coordinates } = req.body;

  if (!location) {
    return res.status(400).json({ message: 'Location is required' });
  }

  try {
    const result = await query(
      'INSERT INTO leak_detections (location, leak_type, severity, estimated_loss_gpd, coordinates) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [location, leak_type, severity, estimated_loss_gpd, coordinates]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Leak detection recorded successfully' });
  } catch (error) {
    console.error('Error recording leak detection:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Energy consumption
router.get('/energy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM energy_consumption ORDER BY measurement_date DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching energy consumption:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/energy', authenticateToken, async (req: Request<{}, {}, EnergyConsumptionRequest>, res: Response) => {
  const { asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, notes } = req.body;

  if (!facility_name || !measurement_date) {
    return res.status(400).json({ message: 'Facility name and measurement date are required' });
  }

  try {
    const result = await query(
      'INSERT INTO energy_consumption (asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, notes]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Energy consumption recorded successfully' });
  } catch (error) {
    console.error('Error recording energy consumption:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

// Regulatory compliance
router.get('/regulatory-compliance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM regulatory_compliance ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regulatory compliance:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

router.post('/regulatory-compliance', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, RegulatoryComplianceRequest>, res: Response) => {
  const { regulation_name, regulation_type, description, compliance_date, next_due_date, status = 'pending', responsible_party, documentation_path, notes } = req.body;

  if (!regulation_name || !regulation_type) {
    return res.status(400).json({ message: 'Regulation name and type are required' });
  }

  try {
    const result = await query(
      'INSERT INTO regulatory_compliance (regulation_name, regulation_type, description, compliance_date, next_due_date, status, responsible_party, documentation_path, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [regulation_name, regulation_type, description, compliance_date, next_due_date, status, responsible_party, documentation_path, notes]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Regulatory compliance record added successfully' });
  } catch (error) {
    console.error('Error adding regulatory compliance record:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

export default router;
