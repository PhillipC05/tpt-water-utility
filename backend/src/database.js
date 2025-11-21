const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/water_utility.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'operator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sensors table
  db.run(`
    CREATE TABLE IF NOT EXISTS sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'active',
      last_reading REAL,
      last_updated DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Readings table
  db.run(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id INTEGER,
      value REAL NOT NULL,
      unit TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sensor_id) REFERENCES sensors (id)
    )
  `);

  // Assets table
  db.run(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'operational',
      installation_date DATE,
      last_maintenance DATE,
      next_maintenance DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Compliance standards table
  db.run(`
    CREATE TABLE IF NOT EXISTS compliance_standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parameter TEXT NOT NULL,
      standard_value REAL,
      unit TEXT,
      regulatory_body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Treatment processes table
  db.run(`
    CREATE TABLE IF NOT EXISTS treatment_processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'operational',
      capacity REAL,
      unit TEXT,
      location TEXT,
      last_maintenance DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pumps table
  db.run(`
    CREATE TABLE IF NOT EXISTS pumps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT,
      status TEXT DEFAULT 'operational',
      flow_rate REAL,
      pressure REAL,
      power_consumption REAL,
      installation_date DATE,
      last_maintenance DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Water quality readings table
  db.run(`
    CREATE TABLE IF NOT EXISTS water_quality (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      ph REAL,
      turbidity REAL,
      chlorine REAL,
      conductivity REAL,
      temperature REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Alerts table
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'active',
      sensor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sensor_id) REFERENCES sensors (id)
    )
  `);

  // Notification logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      alert_id INTEGER,
      success BOOLEAN DEFAULT 0,
      message_id TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (alert_id) REFERENCES alerts (id)
    )
  `);

  // Maintenance schedules table
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      schedule_type TEXT NOT NULL,
      cron_expression TEXT,
      next_run DATETIME,
      last_run DATETIME,
      is_active BOOLEAN DEFAULT 1,
      priority TEXT DEFAULT 'medium',
      estimated_duration INTEGER,
      assigned_to INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets (id),
      FOREIGN KEY (assigned_to) REFERENCES users (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  // Maintenance logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      asset_id INTEGER,
      performed_by INTEGER,
      start_time DATETIME,
      end_time DATETIME,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      parts_used TEXT,
      cost REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES maintenance_schedules (id),
      FOREIGN KEY (asset_id) REFERENCES assets (id),
      FOREIGN KEY (performed_by) REFERENCES users (id)
    )
  `);

  // Audit logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      sub_event TEXT,
      user_id INTEGER,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Customer accounts table
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      account_number VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      service_address TEXT NOT NULL,
      mailing_address TEXT,
      phone VARCHAR(50),
      email VARCHAR(255),
      account_status VARCHAR(20) DEFAULT 'active',
      service_type VARCHAR(50) DEFAULT 'residential',
      meter_number VARCHAR(100),
      meter_size VARCHAR(20),
      installation_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Meter readings table
  db.run(`
    CREATE TABLE IF NOT EXISTS meter_readings (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      meter_number VARCHAR(100) NOT NULL,
      reading_date DATE NOT NULL,
      reading_value DECIMAL(10,2) NOT NULL,
      reading_type VARCHAR(20) DEFAULT 'regular',
      units VARCHAR(10) DEFAULT 'gallons',
      recorded_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Billing cycles table
  db.run(`
    CREATE TABLE IF NOT EXISTS billing_cycles (
      id SERIAL PRIMARY KEY,
      cycle_name VARCHAR(100) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      billing_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bills table
  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      billing_cycle_id INTEGER REFERENCES billing_cycles(id),
      bill_number VARCHAR(50) UNIQUE NOT NULL,
      service_period_start DATE NOT NULL,
      service_period_end DATE NOT NULL,
      previous_reading DECIMAL(10,2),
      current_reading DECIMAL(10,2),
      consumption DECIMAL(10,2),
      base_charge DECIMAL(8,2) DEFAULT 0,
      consumption_charge DECIMAL(8,2) DEFAULT 0,
      sewer_charge DECIMAL(8,2) DEFAULT 0,
      stormwater_charge DECIMAL(8,2) DEFAULT 0,
      other_charges DECIMAL(8,2) DEFAULT 0,
      total_amount DECIMAL(8,2) NOT NULL,
      due_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'unpaid',
      payment_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      payment_date DATE NOT NULL,
      amount DECIMAL(8,2) NOT NULL,
      payment_method VARCHAR(50),
      transaction_id VARCHAR(100),
      status VARCHAR(20) DEFAULT 'completed',
      notes TEXT,
      processed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Service requests table
  db.run(`
    CREATE TABLE IF NOT EXISTS service_requests (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      request_type VARCHAR(50) NOT NULL,
      priority VARCHAR(20) DEFAULT 'normal',
      description TEXT NOT NULL,
      service_address TEXT,
      contact_name VARCHAR(255),
      contact_phone VARCHAR(50),
      contact_email VARCHAR(255),
      status VARCHAR(20) DEFAULT 'open',
      assigned_to INTEGER REFERENCES users(id),
      scheduled_date DATE,
      completed_date DATE,
      estimated_cost DECIMAL(8,2),
      actual_cost DECIMAL(8,2),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Work orders table
  db.run(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id SERIAL PRIMARY KEY,
      service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
      work_order_number VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      priority VARCHAR(20) DEFAULT 'normal',
      status VARCHAR(20) DEFAULT 'open',
      assigned_to INTEGER REFERENCES users(id),
      scheduled_date DATE,
      completed_date DATE,
      estimated_hours DECIMAL(4,2),
      actual_hours DECIMAL(4,2),
      estimated_cost DECIMAL(8,2),
      actual_cost DECIMAL(8,2),
      location TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Leak detection and water loss table
  db.run(`
    CREATE TABLE IF NOT EXISTS leak_detection (
      id SERIAL PRIMARY KEY,
      location TEXT NOT NULL,
      leak_type VARCHAR(50),
      severity VARCHAR(20) DEFAULT 'minor',
      detected_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      reported_by INTEGER REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'detected',
      estimated_loss_gpd DECIMAL(8,2),
      repair_date DATE,
      repair_cost DECIMAL(8,2),
      repair_notes TEXT,
      coordinates POINT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Energy consumption table
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_consumption (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
      facility_name VARCHAR(255) NOT NULL,
      measurement_date DATE NOT NULL,
      electricity_kwh DECIMAL(10,2),
      electricity_cost DECIMAL(8,2),
      natural_gas_therms DECIMAL(10,2),
      natural_gas_cost DECIMAL(8,2),
      diesel_gallons DECIMAL(10,2),
      diesel_cost DECIMAL(8,2),
      total_cost DECIMAL(8,2),
      recorded_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Regulatory compliance table
  db.run(`
    CREATE TABLE IF NOT EXISTS regulatory_compliance (
      id SERIAL PRIMARY KEY,
      regulation_name VARCHAR(255) NOT NULL,
      regulation_type VARCHAR(50) NOT NULL,
      description TEXT,
      compliance_date DATE,
      next_due_date DATE,
      status VARCHAR(20) DEFAULT 'compliant',
      responsible_party INTEGER REFERENCES users(id),
      documentation_path TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add notification preferences to users table
  db.run(`
    ALTER TABLE users ADD COLUMN email_notifications BOOLEAN DEFAULT 1
  `).run();

  db.run(`
    ALTER TABLE users ADD COLUMN sms_notifications BOOLEAN DEFAULT 0
  `).run();

  db.run(`
    ALTER TABLE users ADD COLUMN phone TEXT
  `).run();

  console.log('Database initialized successfully');
});

module.exports = db;
