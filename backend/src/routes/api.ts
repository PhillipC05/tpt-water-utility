import express, { Request, Response, Router } from 'express';
import { query } from '../database';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

// ─── Type Definitions ────────────────────────────────────────────────────────

interface SensorRequest {
  name: string;
  type: string;
  location?: string;
  status?: string;
}

interface ReadingRequest {
  sensor_id: number;
  value: number;
  unit?: string;
}

interface BulkReadingRequest {
  readings: ReadingRequest[];
}

interface AssetRequest {
  name: string;
  type: string;
  location?: string;
  installation_date?: string;
  status?: string;
  last_maintenance?: string;
  next_maintenance?: string;
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

interface AlertUpdateRequest {
  status?: string;
  severity?: string;
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

interface PaymentRequest {
  bill_id?: number;
  customer_id: number;
  payment_date: string;
  amount: number;
  payment_method?: string;
  transaction_id?: string;
  notes?: string;
}

interface BillingCycleRequest {
  cycle_name: string;
  start_date: string;
  end_date: string;
  billing_date: string;
  due_date: string;
}

interface WebhookRequest {
  url: string;
  secret?: string;
  events?: string[];
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function parsePagination(query: any): { limit: number; offset: number } {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(query.limit as string) || 50));
  return { limit, offset: (page - 1) * limit };
}

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowsToCsv(rows: any[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map(row => columns.map(col => escapeCsvValue(row[col])).join(','));
  return [header, ...body].join('\n');
}

async function fireWebhooks(event: string, payload: any): Promise<void> {
  try {
    const result = await query(
      `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events)`,
      [event]
    );
    const https = await import('https');
    const http = await import('http');
    for (const hook of result.rows) {
      try {
        const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
        const url = new URL(hook.url);
        const client = url.protocol === 'https:' ? https : http;
        const options = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...(hook.secret ? { 'X-Webhook-Secret': hook.secret } : {}),
          },
        };
        const req = (client as any).request(options, (res: any) => {
          query(
            `UPDATE webhooks SET last_triggered_at = NOW(), last_status = $1 WHERE id = $2`,
            [res.statusCode, hook.id]
          ).catch(() => {});
        });
        req.on('error', () => {});
        req.write(body);
        req.end();
      } catch {
        // Non-blocking — webhook failures should never break the main flow
      }
    }
  } catch {
    // Webhook delivery is best-effort
  }
}

const router: Router = express.Router();

// ─── Sensors ──────────────────────────────────────────────────────────────────

router.get('/sensors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await query(
      'SELECT * FROM sensors ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/sensors/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM sensors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Sensor not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching sensor:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/sensors', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, SensorRequest>, res: Response) => {
  const { name, type, location } = req.body;
  if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
  try {
    const result = await query(
      'INSERT INTO sensors (name, type, location) VALUES ($1, $2, $3) RETURNING id',
      [name, type, location]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Sensor added successfully' });
  } catch (error) {
    console.error('Error adding sensor:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/sensors/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }, {}, Partial<SensorRequest>>, res: Response) => {
  const { name, type, location, status } = req.body;
  if (!name && !type && !location && !status) {
    return res.status(400).json({ message: 'At least one field must be provided' });
  }
  try {
    const existing = await query('SELECT id FROM sensors WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Sensor not found' });
    await query(
      `UPDATE sensors SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        location = COALESCE($3, location),
        status = COALESCE($4, status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [name, type, location, status, req.params.id]
    );
    return res.json({ message: 'Sensor updated successfully' });
  } catch (error) {
    console.error('Error updating sensor:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/sensors/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const existing = await query('SELECT id FROM sensors WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Sensor not found' });
    await query('DELETE FROM sensors WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Sensor deleted successfully' });
  } catch (error) {
    console.error('Error deleting sensor:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/sensors/:id/readings', authenticateToken, async (req: Request, res: Response) => {
  const { limit, offset } = parsePagination(req.query);
  try {
    const result = await query(
      'SELECT * FROM readings WHERE sensor_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sensor readings:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Readings ─────────────────────────────────────────────────────────────────

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
    await query(
      'UPDATE sensors SET last_reading = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2',
      [value, sensor_id]
    );
    return res.status(201).json({ id: insertResult.rows[0].id, message: 'Reading added successfully' });
  } catch (error) {
    console.error('Error adding reading:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/readings/bulk', authenticateToken, async (req: Request<{}, {}, BulkReadingRequest>, res: Response) => {
  const { readings } = req.body;
  if (!Array.isArray(readings) || readings.length === 0) {
    return res.status(400).json({ message: 'readings array is required' });
  }
  if (readings.length > 1000) {
    return res.status(400).json({ message: 'Maximum 1000 readings per batch' });
  }
  try {
    const values: any[] = [];
    const placeholders = readings.map((r, i) => {
      const base = i * 3;
      values.push(r.sensor_id, r.value, r.unit || null);
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    });
    await query(
      `INSERT INTO readings (sensor_id, value, unit) VALUES ${placeholders.join(', ')}`,
      values
    );
    const sensorIds = [...new Set(readings.map(r => r.sensor_id))];
    for (const sid of sensorIds) {
      const latest = readings.filter(r => r.sensor_id === sid).at(-1);
      if (latest) {
        await query(
          'UPDATE sensors SET last_reading = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2',
          [latest.value, sid]
        );
      }
    }
    return res.status(201).json({ message: `${readings.length} readings inserted` });
  } catch (error) {
    console.error('Error bulk-inserting readings:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Assets ───────────────────────────────────────────────────────────────────

router.get('/assets', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await query('SELECT * FROM assets ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/assets', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, AssetRequest>, res: Response) => {
  const { name, type, location, installation_date } = req.body;
  if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
  try {
    const result = await query(
      'INSERT INTO assets (name, type, location, installation_date) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, type, location, installation_date]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Asset added successfully' });
  } catch (error) {
    console.error('Error adding asset:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/assets/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }, {}, Partial<AssetRequest>>, res: Response) => {
  const { name, type, location, status, installation_date, last_maintenance, next_maintenance } = req.body;
  try {
    const existing = await query('SELECT id FROM assets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Asset not found' });
    await query(
      `UPDATE assets SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        location = COALESCE($3, location),
        status = COALESCE($4, status),
        installation_date = COALESCE($5, installation_date),
        last_maintenance = COALESCE($6, last_maintenance),
        next_maintenance = COALESCE($7, next_maintenance),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [name, type, location, status, installation_date, last_maintenance, next_maintenance, req.params.id]
    );
    return res.json({ message: 'Asset updated successfully' });
  } catch (error) {
    console.error('Error updating asset:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/assets/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const existing = await query('SELECT id FROM assets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Asset not found' });
    await query('DELETE FROM assets WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Compliance Standards ─────────────────────────────────────────────────────

router.get('/compliance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM compliance_standards ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching compliance standards:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Treatment ────────────────────────────────────────────────────────────────

router.get('/treatment', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM treatment_processes ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching treatment processes:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/treatment', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, TreatmentRequest>, res: Response) => {
  const { name, type, capacity, unit, location } = req.body;
  if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
  try {
    const result = await query(
      'INSERT INTO treatment_processes (name, type, capacity, unit, location) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, type, capacity, unit, location]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Treatment process added successfully' });
  } catch (error) {
    console.error('Error adding treatment process:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Pumps ────────────────────────────────────────────────────────────────────

router.get('/pumps', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM pumps ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pumps:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/pumps', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, PumpRequest>, res: Response) => {
  const { name, type, location, flow_rate, pressure, power_consumption } = req.body;
  if (!name || !type) return res.status(400).json({ message: 'Name and type are required' });
  try {
    const result = await query(
      'INSERT INTO pumps (name, type, location, flow_rate, pressure, power_consumption) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, type, location, flow_rate, pressure, power_consumption]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Pump added successfully' });
  } catch (error) {
    console.error('Error adding pump:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Water Quality ────────────────────────────────────────────────────────────

router.get('/water-quality', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await query(
      'SELECT * FROM water_quality ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching water quality data:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/water-quality', authenticateToken, async (req: Request<{}, {}, WaterQualityRequest>, res: Response) => {
  const { location, ph, turbidity, chlorine, conductivity, temperature } = req.body;
  if (!location) return res.status(400).json({ message: 'Location is required' });
  try {
    const result = await query(
      'INSERT INTO water_quality (location, ph, turbidity, chlorine, conductivity, temperature) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [location, ph, turbidity, chlorine, conductivity, temperature]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Water quality reading added successfully' });
  } catch (error) {
    console.error('Error adding water quality reading:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

router.get('/alerts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;
    let text = 'SELECT * FROM alerts WHERE 1=1';
    const params: any[] = [];
    if (status) { params.push(status); text += ` AND status = $${params.length}`; }
    if (severity) { params.push(severity); text += ` AND severity = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/alerts', authenticateToken, async (req: Request<{}, {}, AlertRequest>, res: Response) => {
  const { type, message, severity = 'medium', sensor_id } = req.body;
  if (!type || !message) return res.status(400).json({ message: 'Type and message are required' });
  try {
    const result = await query(
      'INSERT INTO alerts (type, message, severity, sensor_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [type, message, severity, sensor_id]
    );
    const alertId = result.rows[0].id;
    await fireWebhooks('alert', { id: alertId, type, message, severity, sensor_id });
    return res.status(201).json({ id: alertId, message: 'Alert created successfully' });
  } catch (error) {
    console.error('Error creating alert:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/alerts/:id', authenticateToken, async (req: Request<{ id: string }, {}, AlertUpdateRequest>, res: Response) => {
  const { status, severity } = req.body;
  if (!status && !severity) return res.status(400).json({ message: 'status or severity required' });
  try {
    const existing = await query('SELECT id FROM alerts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Alert not found' });
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    await query(
      `UPDATE alerts SET
        status = COALESCE($1, status),
        severity = COALESCE($2, severity),
        resolved_at = CASE WHEN $1 = 'resolved' THEN $3 ELSE resolved_at END
       WHERE id = $4`,
      [status || null, severity || null, resolvedAt, req.params.id]
    );
    return res.json({ message: 'Alert updated successfully' });
  } catch (error) {
    console.error('Error updating alert:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/alerts/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const existing = await query('SELECT id FROM alerts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Alert not found' });
    await query('DELETE FROM alerts WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── IoT Commands ─────────────────────────────────────────────────────────────

router.post('/iot/command', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, IotCommandRequest>, res: Response) => {
  const { topic, command } = req.body;
  if (!topic || !command) return res.status(400).json({ message: 'Topic and command are required' });
  try {
    const iotService = (await import('../iot-service')).default;
    iotService.publishCommand(topic, { command, timestamp: new Date().toISOString() });
    return res.json({ message: 'IoT command sent successfully' });
  } catch (error) {
    console.error('Error sending IoT command:', error);
    return res.status(500).json({ message: 'Failed to send IoT command' });
  }
});

// ─── Notification Test ────────────────────────────────────────────────────────

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
    return res.json({ message: 'Test notifications sent successfully' });
  } catch (error) {
    console.error('Error sending test notifications:', error);
    return res.status(500).json({ message: 'Failed to send test notifications' });
  }
});

// ─── User Management ──────────────────────────────────────────────────────────

router.get('/users/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, username, email, role, phone, email_notifications, sms_notifications, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/users/me', authenticateToken, async (req: Request<{}, {}, Pick<UserUpdateRequest, 'phone' | 'email_notifications' | 'sms_notifications'>>, res: Response) => {
  const { phone, email_notifications, sms_notifications } = req.body;
  try {
    await query(
      `UPDATE users SET phone = COALESCE($1, phone), email_notifications = COALESCE($2, email_notifications),
       sms_notifications = COALESCE($3, sms_notifications), updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
      [phone, email_notifications, sms_notifications, req.user!.id]
    );
    return res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/users', authenticateToken, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, username, email, role, phone, email_notifications, sms_notifications, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: 'Database error' });
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
    return res.status(201).json({ id: result.rows[0].id, message: 'User created successfully' });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ message: 'Username or email already exists' });
    console.error('Error creating user:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/users/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }, {}, UserUpdateRequest>, res: Response) => {
  const { username, email, role, phone, email_notifications, sms_notifications } = req.body;
  try {
    await query(
      `UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email),
       role = COALESCE($3, role), phone = COALESCE($4, phone),
       email_notifications = COALESCE($5, email_notifications),
       sms_notifications = COALESCE($6, sms_notifications),
       updated_at = CURRENT_TIMESTAMP WHERE id = $7`,
      [username, email, role, phone, email_notifications, sms_notifications, req.params.id]
    );
    return res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/users/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  if (String(req.user!.id) === req.params.id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Maintenance ──────────────────────────────────────────────────────────────

router.get('/maintenance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await query(
      `SELECT ms.*, a.name as asset_name, u.username as assigned_username
       FROM maintenance_schedules ms
       LEFT JOIN assets a ON ms.asset_id = a.id
       LEFT JOIN users u ON ms.assigned_to = u.id
       ORDER BY ms.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance schedules:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/maintenance/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const assetId = req.query.asset_id as string | undefined;
    const maintenanceService = (await import('../maintenance-service')).default;
    const rows = await maintenanceService.getMaintenanceHistory(assetId ? parseInt(assetId) : null, limit);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/maintenance/upcoming', authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const maintenanceService = (await import('../maintenance-service')).default;
    const rows = await maintenanceService.getUpcomingMaintenance(days);
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching upcoming maintenance:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/maintenance', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, MaintenanceScheduleRequest>, res: Response) => {
  const { asset_id, title, schedule_type } = req.body;
  if (!asset_id || !title || !schedule_type) {
    return res.status(400).json({ message: 'Asset ID, title, and schedule type are required' });
  }
  try {
    const maintenanceService = (await import('../maintenance-service')).default;
    const schedule = await maintenanceService.createSchedule(req.body, req.user!.id);
    return res.status(201).json(schedule);
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/maintenance/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }, {}, Partial<MaintenanceScheduleRequest>>, res: Response) => {
  try {
    const maintenanceService = (await import('../maintenance-service')).default;
    const schedule = await maintenanceService.updateSchedule(Number(req.params.id), req.body);
    return res.json(schedule);
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/maintenance/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const maintenanceService = (await import('../maintenance-service')).default;
    await maintenanceService.deleteSchedule(Number(req.params.id));
    return res.json({ message: 'Maintenance schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance schedule:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── SCADA Control ────────────────────────────────────────────────────────────

router.post('/scada/control', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, ScadaControlRequest>, res: Response) => {
  const { command, parameters } = req.body;
  if (!command) return res.status(400).json({ message: 'Command is required' });
  try {
    const auditService = (await import('../audit-service')).default;
    auditService.logSystemEvent('scada_command', { command, parameters, userId: req.user!.id });
    return res.json({ message: 'SCADA command executed successfully', command, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error executing SCADA command:', error);
    return res.status(500).json({ message: 'Failed to execute SCADA command' });
  }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

router.get('/audit', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, {}, AuditQueryRequest>, res: Response) => {
  const { event_type, sub_event, user_id, start_date, end_date, limit = '100', offset = '0' } = req.query;
  try {
    let queryText = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    if (event_type) { queryText += ` AND event_type = $${paramIndex++}`; params.push(event_type); }
    if (sub_event) { queryText += ` AND sub_event = $${paramIndex++}`; params.push(sub_event); }
    if (user_id) { queryText += ` AND user_id = $${paramIndex++}`; params.push(user_id); }
    if (start_date) { queryText += ` AND created_at >= $${paramIndex++}`; params.push(start_date); }
    if (end_date) { queryText += ` AND created_at <= $${paramIndex++}`; params.push(end_date); }
    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    const result = await query(queryText, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/audit/cleanup', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, AuditCleanupRequest>, res: Response) => {
  const { daysToKeep = 90 } = req.body;
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const result = await query('DELETE FROM audit_logs WHERE created_at < $1', [cutoffDate.toISOString()]);
    return res.json({ message: `Cleaned up ${result.rowCount} audit log entries` });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Customers ────────────────────────────────────────────────────────────────

router.get('/customers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = req.query.search as string | undefined;
    let text = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      text += ` AND (customer_name ILIKE $${params.length} OR account_number ILIKE $${params.length} OR service_address ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    text += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/customers/export.csv', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT account_number, customer_name, service_address, mailing_address, phone, email, account_status, service_type, meter_number, meter_size, installation_date, created_at FROM customers ORDER BY customer_name'
    );
    const columns = ['account_number', 'customer_name', 'service_address', 'mailing_address', 'phone', 'email', 'account_status', 'service_type', 'meter_number', 'meter_size', 'installation_date', 'created_at'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');
    return res.send(rowsToCsv(result.rows, columns));
  } catch (error) {
    console.error('Error exporting customers:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/customers/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return res.status(500).json({ message: 'Database error' });
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
    return res.status(201).json({ id: result.rows[0].id, message: 'Customer added successfully' });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ message: 'Account number already exists' });
    console.error('Error adding customer:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/customers/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }, {}, Partial<CustomerRequest>>, res: Response) => {
  const { customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date } = req.body;
  try {
    const existing = await query('SELECT id FROM customers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    await query(
      `UPDATE customers SET
        customer_name = COALESCE($1, customer_name),
        service_address = COALESCE($2, service_address),
        mailing_address = COALESCE($3, mailing_address),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        service_type = COALESCE($6, service_type),
        meter_number = COALESCE($7, meter_number),
        meter_size = COALESCE($8, meter_size),
        installation_date = COALESCE($9, installation_date),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [customer_name, service_address, mailing_address, phone, email, service_type, meter_number, meter_size, installation_date, req.params.id]
    );
    return res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/customers/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const existing = await query('SELECT id FROM customers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
    await query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Meter Readings ───────────────────────────────────────────────────────────

router.get('/meter-readings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const customerId = req.query.customer_id as string | undefined;
    let text = 'SELECT * FROM meter_readings WHERE 1=1';
    const params: any[] = [];
    if (customerId) { params.push(customerId); text += ` AND customer_id = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY reading_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching meter readings:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/meter-readings/export.csv', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customer_id as string | undefined;
    let text = `SELECT mr.*, c.customer_name, c.account_number
                FROM meter_readings mr LEFT JOIN customers c ON mr.customer_id = c.id WHERE 1=1`;
    const params: any[] = [];
    if (customerId) { params.push(customerId); text += ` AND mr.customer_id = $${params.length}`; }
    text += ' ORDER BY reading_date DESC';
    const result = await query(text, params);
    const columns = ['account_number', 'customer_name', 'meter_number', 'reading_date', 'reading_value', 'units', 'reading_type', 'notes'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="meter-readings.csv"');
    return res.send(rowsToCsv(result.rows, columns));
  } catch (error) {
    console.error('Error exporting meter readings:', error);
    return res.status(500).json({ message: 'Database error' });
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
    return res.status(201).json({ id: result.rows[0].id, message: 'Meter reading added successfully' });
  } catch (error) {
    console.error('Error adding meter reading:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Billing Cycles ───────────────────────────────────────────────────────────

router.get('/billing-cycles', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM billing_cycles ORDER BY start_date DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching billing cycles:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/billing-cycles', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, BillingCycleRequest>, res: Response) => {
  const { cycle_name, start_date, end_date, billing_date, due_date } = req.body;
  if (!cycle_name || !start_date || !end_date || !billing_date || !due_date) {
    return res.status(400).json({ message: 'All date fields are required' });
  }
  try {
    const result = await query(
      'INSERT INTO billing_cycles (cycle_name, start_date, end_date, billing_date, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [cycle_name, start_date, end_date, billing_date, due_date]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Billing cycle created successfully' });
  } catch (error) {
    console.error('Error creating billing cycle:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Bills ────────────────────────────────────────────────────────────────────

router.get('/bills', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const customerId = req.query.customer_id as string | undefined;
    const status = req.query.status as string | undefined;
    let text = 'SELECT b.*, c.customer_name, c.account_number FROM bills b LEFT JOIN customers c ON b.customer_id = c.id WHERE 1=1';
    const params: any[] = [];
    if (customerId) { params.push(customerId); text += ` AND b.customer_id = $${params.length}`; }
    if (status) { params.push(status); text += ` AND b.status = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY b.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bills:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/bills', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, BillRequest>, res: Response) => {
  const { customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date } = req.body;
  if (!customer_id || !bill_number || !service_period_start || !service_period_end || total_amount === undefined || !due_date) {
    return res.status(400).json({ message: 'Customer ID, bill number, service period, total amount, and due date are required' });
  }
  try {
    const result = await query(
      'INSERT INTO bills (customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id',
      [customer_id, billing_cycle_id, bill_number, service_period_start, service_period_end, previous_reading, current_reading, consumption, base_charge, consumption_charge, sewer_charge, stormwater_charge, other_charges, total_amount, due_date]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Bill created successfully' });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ message: 'Bill number already exists' });
    console.error('Error creating bill:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────

router.get('/payments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const customerId = req.query.customer_id as string | undefined;
    let text = 'SELECT p.*, c.customer_name, c.account_number FROM payments p LEFT JOIN customers c ON p.customer_id = c.id WHERE 1=1';
    const params: any[] = [];
    if (customerId) { params.push(customerId); text += ` AND p.customer_id = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY p.payment_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/payments', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, PaymentRequest>, res: Response) => {
  const { bill_id, customer_id, payment_date, amount, payment_method, transaction_id, notes } = req.body;
  if (!customer_id || !payment_date || amount === undefined) {
    return res.status(400).json({ message: 'Customer ID, payment date, and amount are required' });
  }
  try {
    const result = await query(
      'INSERT INTO payments (bill_id, customer_id, payment_date, amount, payment_method, transaction_id, notes, processed_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [bill_id, customer_id, payment_date, amount, payment_method, transaction_id, notes, req.user!.id]
    );
    if (bill_id) {
      await query(`UPDATE bills SET status = 'paid', payment_date = $1 WHERE id = $2`, [payment_date, bill_id]);
    }
    return res.status(201).json({ id: result.rows[0].id, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Error recording payment:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Service Requests ─────────────────────────────────────────────────────────

router.get('/service-requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    let text = 'SELECT sr.*, c.customer_name FROM service_requests sr LEFT JOIN customers c ON sr.customer_id = c.id WHERE 1=1';
    const params: any[] = [];
    if (status) { params.push(status); text += ` AND sr.status = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY sr.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service requests:', error);
    return res.status(500).json({ message: 'Database error' });
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
    return res.status(201).json({ id: result.rows[0].id, message: 'Service request created successfully' });
  } catch (error) {
    console.error('Error creating service request:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Work Orders ──────────────────────────────────────────────────────────────

router.get('/work-orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    let text = 'SELECT wo.*, u.username as assigned_username FROM work_orders wo LEFT JOIN users u ON wo.assigned_to = u.id WHERE 1=1';
    const params: any[] = [];
    if (status) { params.push(status); text += ` AND wo.status = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY wo.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/work-orders', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{}, {}, WorkOrderRequest>, res: Response) => {
  const { service_request_id, work_order_number, title, description, priority = 'medium', assigned_to, scheduled_date, estimated_hours, estimated_cost, location } = req.body;
  if (!work_order_number || !title) {
    return res.status(400).json({ message: 'Work order number and title are required' });
  }
  try {
    const result = await query(
      'INSERT INTO work_orders (service_request_id, work_order_number, title, description, priority, assigned_to, scheduled_date, estimated_hours, estimated_cost, location, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
      [service_request_id, work_order_number, title, description, priority, assigned_to, scheduled_date, estimated_hours, estimated_cost, location, req.user!.id]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Work order created successfully' });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ message: 'Work order number already exists' });
    console.error('Error creating work order:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Leak Detection ───────────────────────────────────────────────────────────

router.get('/leaks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    let text = 'SELECT * FROM leak_detections WHERE 1=1';
    const params: any[] = [];
    if (status) { params.push(status); text += ` AND status = $${params.length}`; }
    params.push(limit, offset);
    text += ` ORDER BY detected_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await query(text, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leak detections:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/leaks', authenticateToken, async (req: Request<{}, {}, LeakDetectionRequest>, res: Response) => {
  const { location, leak_type = 'unknown', severity = 'low', estimated_loss_gpd, coordinates } = req.body;
  if (!location) return res.status(400).json({ message: 'Location is required' });
  try {
    const result = await query(
      'INSERT INTO leak_detections (location, leak_type, severity, estimated_loss_gpd, coordinates, reported_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [location, leak_type, severity, estimated_loss_gpd, coordinates ? JSON.stringify(coordinates) : null, req.user!.id]
    );
    await fireWebhooks('leak_detected', { id: result.rows[0].id, location, severity });
    return res.status(201).json({ id: result.rows[0].id, message: 'Leak detection recorded successfully' });
  } catch (error) {
    console.error('Error recording leak detection:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/leaks/:id', authenticateToken, authorizeRoles('admin', 'operator'), async (req: Request<{ id: string }>, res: Response) => {
  const { status, repair_date, repair_cost, repair_notes } = req.body as any;
  try {
    const existing = await query('SELECT id FROM leak_detections WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Leak record not found' });
    await query(
      `UPDATE leak_detections SET
        status = COALESCE($1, status),
        repair_date = COALESCE($2, repair_date),
        repair_cost = COALESCE($3, repair_cost),
        repair_notes = COALESCE($4, repair_notes)
       WHERE id = $5`,
      [status, repair_date, repair_cost, repair_notes, req.params.id]
    );
    return res.json({ message: 'Leak record updated successfully' });
  } catch (error) {
    console.error('Error updating leak record:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Energy Consumption ───────────────────────────────────────────────────────

router.get('/energy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await query(
      'SELECT * FROM energy_consumption ORDER BY measurement_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching energy consumption:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/energy', authenticateToken, async (req: Request<{}, {}, EnergyConsumptionRequest>, res: Response) => {
  const { asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, notes } = req.body;
  if (!facility_name || !measurement_date) {
    return res.status(400).json({ message: 'Facility name and measurement date are required' });
  }
  try {
    const total_cost = (electricity_cost || 0) + (natural_gas_cost || 0) + (diesel_cost || 0);
    const result = await query(
      'INSERT INTO energy_consumption (asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, total_cost, recorded_by, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
      [asset_id, facility_name, measurement_date, electricity_kwh, electricity_cost, natural_gas_therms, natural_gas_cost, diesel_gallons, diesel_cost, total_cost, req.user!.id, notes]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Energy consumption recorded successfully' });
  } catch (error) {
    console.error('Error recording energy consumption:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Regulatory Compliance ────────────────────────────────────────────────────

router.get('/regulatory-compliance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const result = await query(
      'SELECT * FROM regulatory_compliance ORDER BY next_due_date ASC NULLS LAST LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching regulatory compliance:', error);
    return res.status(500).json({ message: 'Database error' });
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
    return res.status(201).json({ id: result.rows[0].id, message: 'Regulatory compliance record added successfully' });
  } catch (error) {
    console.error('Error adding regulatory compliance record:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Reports ──────────────────────────────────────────────────────────────────

router.get('/reports/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const [sensors, alerts, assets, customers, maintenance, leaks] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM sensors`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active,
             COUNT(*) FILTER (WHERE severity = 'critical') as critical,
             COUNT(*) FILTER (WHERE severity = 'high') as high FROM alerts`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'operational') as operational FROM assets`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE account_status = 'active') as active FROM customers`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM maintenance_schedules`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'detected') as open, COALESCE(SUM(estimated_loss_gpd), 0) as total_loss_gpd FROM leak_detections`),
    ]);
    return res.json({
      sensors: sensors.rows[0],
      alerts: alerts.rows[0],
      assets: assets.rows[0],
      customers: customers.rows[0],
      maintenance: maintenance.rows[0],
      leaks: leaks.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating summary report:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/reports/water-quality', authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const result = await query(
      `SELECT
         location,
         ROUND(AVG(ph)::numeric, 2) as avg_ph,
         ROUND(AVG(turbidity)::numeric, 2) as avg_turbidity,
         ROUND(AVG(chlorine)::numeric, 3) as avg_chlorine,
         ROUND(AVG(conductivity)::numeric, 2) as avg_conductivity,
         ROUND(AVG(temperature)::numeric, 2) as avg_temperature,
         COUNT(*) as reading_count,
         MAX(timestamp) as latest_reading
       FROM water_quality
       WHERE timestamp >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY location
       ORDER BY location`,
      [days]
    );
    return res.json({ period_days: days, locations: result.rows });
  } catch (error) {
    console.error('Error generating water quality report:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/reports/energy', authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const result = await query(
      `SELECT
         facility_name,
         ROUND(SUM(electricity_kwh)::numeric, 2) as total_kwh,
         ROUND(SUM(electricity_cost)::numeric, 2) as total_electricity_cost,
         ROUND(SUM(total_cost)::numeric, 2) as total_cost,
         COUNT(*) as records
       FROM energy_consumption
       WHERE measurement_date >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY facility_name
       ORDER BY total_cost DESC`,
      [days]
    );
    return res.json({ period_days: days, facilities: result.rows });
  } catch (error) {
    console.error('Error generating energy report:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.get('/analytics/nrw', authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    // Total produced: sum of all flow sensor readings in period
    const producedResult = await query(
      `SELECT COALESCE(SUM(r.value), 0) as total_produced
       FROM readings r
       JOIN sensors s ON r.sensor_id = s.id
       WHERE s.type = 'flow'
       AND r.timestamp >= NOW() - ($1 || ' days')::INTERVAL`,
      [days]
    );
    // Total billed: sum of consumption in bills during period
    const billedResult = await query(
      `SELECT COALESCE(SUM(consumption), 0) as total_billed
       FROM bills
       WHERE service_period_start >= NOW() - ($1 || ' days')::INTERVAL`,
      [days]
    );
    const produced = parseFloat(producedResult.rows[0].total_produced);
    const billed = parseFloat(billedResult.rows[0].total_billed);
    const nrw = Math.max(0, produced - billed);
    const nrwPercent = produced > 0 ? ((nrw / produced) * 100).toFixed(2) : '0.00';
    return res.json({
      period_days: days,
      total_produced: produced,
      total_billed: billed,
      nrw_volume: nrw,
      nrw_percent: parseFloat(nrwPercent),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error calculating NRW:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/analytics/anomalies', authenticateToken, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const zThreshold = parseFloat(req.query.z_threshold as string) || 2.5;
    const result = await query(
      `WITH stats AS (
         SELECT sensor_id,
                AVG(value) AS mean,
                STDDEV(value) AS stddev
         FROM readings
         WHERE timestamp >= NOW() - ($1 || ' hours')::INTERVAL
         GROUP BY sensor_id
       )
       SELECT
         r.id,
         r.sensor_id,
         r.value,
         r.unit,
         r.timestamp,
         s.name AS sensor_name,
         s.type AS sensor_type,
         s.location,
         ROUND(st.mean::numeric, 4) AS mean,
         ROUND(st.stddev::numeric, 4) AS stddev,
         ROUND((ABS(r.value - st.mean) / NULLIF(st.stddev, 0))::numeric, 2) AS z_score
       FROM readings r
       JOIN sensors s ON r.sensor_id = s.id
       JOIN stats st ON r.sensor_id = st.sensor_id
       WHERE r.timestamp >= NOW() - ($1 || ' hours')::INTERVAL
         AND st.stddev > 0
         AND ABS(r.value - st.mean) / st.stddev > $2
       ORDER BY z_score DESC
       LIMIT 200`,
      [hours, zThreshold]
    );
    return res.json({
      period_hours: hours,
      z_threshold: zThreshold,
      anomaly_count: result.rows.length,
      anomalies: result.rows,
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.get('/analytics/sensor-trends', authenticateToken, async (req: Request, res: Response) => {
  try {
    const sensorId = req.query.sensor_id as string;
    const hours = parseInt(req.query.hours as string) || 24;
    const buckets = parseInt(req.query.buckets as string) || 24;
    if (!sensorId) return res.status(400).json({ message: 'sensor_id is required' });
    const result = await query(
      `SELECT
         date_trunc('hour', timestamp) + (EXTRACT(minute FROM timestamp)::integer / ($3) * $3 || ' minutes')::INTERVAL AS bucket,
         ROUND(AVG(value)::numeric, 4) AS avg_value,
         ROUND(MIN(value)::numeric, 4) AS min_value,
         ROUND(MAX(value)::numeric, 4) AS max_value,
         COUNT(*) AS reading_count
       FROM readings
       WHERE sensor_id = $1
         AND timestamp >= NOW() - ($2 || ' hours')::INTERVAL
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [sensorId, hours, Math.floor(60 / buckets)]
    );
    return res.json({ sensor_id: sensorId, period_hours: hours, trend: result.rows });
  } catch (error) {
    console.error('Error fetching sensor trends:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

// ─── Webhooks ─────────────────────────────────────────────────────────────────

router.get('/webhooks', authenticateToken, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT id, url, events, is_active, last_triggered_at, last_status, created_at FROM webhooks ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/webhooks', authenticateToken, authorizeRoles('admin'), async (req: Request<{}, {}, WebhookRequest>, res: Response) => {
  const { url, secret, events = ['alert'] } = req.body;
  if (!url) return res.status(400).json({ message: 'URL is required' });
  try {
    new URL(url); // validate URL format
  } catch {
    return res.status(400).json({ message: 'Invalid URL format' });
  }
  try {
    const result = await query(
      'INSERT INTO webhooks (url, secret, events, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
      [url, secret, events, req.user!.id]
    );
    return res.status(201).json({ id: result.rows[0].id, message: 'Webhook registered successfully' });
  } catch (error) {
    console.error('Error registering webhook:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.put('/webhooks/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }, {}, Partial<WebhookRequest> & { is_active?: boolean }>, res: Response) => {
  const { url, secret, events, is_active } = req.body;
  try {
    const existing = await query('SELECT id FROM webhooks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Webhook not found' });
    await query(
      `UPDATE webhooks SET
        url = COALESCE($1, url),
        secret = COALESCE($2, secret),
        events = COALESCE($3, events),
        is_active = COALESCE($4, is_active)
       WHERE id = $5`,
      [url, secret, events, is_active, req.params.id]
    );
    return res.json({ message: 'Webhook updated successfully' });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.delete('/webhooks/:id', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const existing = await query('SELECT id FROM webhooks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Webhook not found' });
    await query('DELETE FROM webhooks WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

router.post('/webhooks/:id/test', authenticateToken, authorizeRoles('admin'), async (req: Request<{ id: string }>, res: Response) => {
  try {
    const result = await query('SELECT * FROM webhooks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Webhook not found' });
    const hook = result.rows[0];
    await fireWebhooks(hook.events[0] || 'test', { message: 'Webhook test from Water Utility Platform' });
    return res.json({ message: 'Test payload sent to webhook' });
  } catch (error) {
    console.error('Error testing webhook:', error);
    return res.status(500).json({ message: 'Database error' });
  }
});

export default router;
