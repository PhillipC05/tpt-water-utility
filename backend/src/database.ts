import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Database configuration
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

interface DatabaseConfigs {
  development: DatabaseConfig;
  production: DatabaseConfig;
}

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig: DatabaseConfigs = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'water_utility',
    user: process.env.DB_USER || 'wateruser',
    password: process.env.DB_PASS || 'waterpass',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  production: {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  } as any
};

const env: string = process.env.NODE_ENV || 'development';
const config: DatabaseConfig = dbConfig[env as keyof DatabaseConfigs] as DatabaseConfig;

// Create connection pool
const pool = new Pool(config);

// Handle pool errors
pool.on('error', (err: Error, client: any) => {
  console.error('Unexpected error on idle client', err);
});

// Test database connection
const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', (err as Error).message);
    return false;
  }
};

// Initialize database tables
const initializeTables = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'operator',
        phone VARCHAR(20),
        email_notifications BOOLEAN DEFAULT true,
        sms_notifications BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sensors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        location TEXT,
        status VARCHAR(20) DEFAULT 'active',
        last_reading DECIMAL(10,4),
        last_updated TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Readings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        value DECIMAL(10,4) NOT NULL,
        unit VARCHAR(20),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        location TEXT,
        status VARCHAR(20) DEFAULT 'operational',
        installation_date DATE,
        last_maintenance DATE,
        next_maintenance DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Compliance standards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_standards (
        id SERIAL PRIMARY KEY,
        parameter VARCHAR(100) NOT NULL,
        standard_value DECIMAL(10,4),
        unit VARCHAR(20),
        regulatory_body VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Treatment processes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS treatment_processes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'operational',
        capacity DECIMAL(10,2),
        unit VARCHAR(20),
        location TEXT,
        last_maintenance DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Pumps table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pumps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        location TEXT,
        status VARCHAR(20) DEFAULT 'operational',
        flow_rate DECIMAL(10,2),
        pressure DECIMAL(10,2),
        power_consumption DECIMAL(10,2),
        installation_date DATE,
        last_maintenance DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Water quality readings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS water_quality (
        id SERIAL PRIMARY KEY,
        location TEXT NOT NULL,
        ph DECIMAL(4,2),
        turbidity DECIMAL(8,2),
        chlorine DECIMAL(6,3),
        conductivity DECIMAL(10,2),
        temperature DECIMAL(5,2),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Alerts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'active',
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Notification logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        alert_id INTEGER REFERENCES alerts(id) ON DELETE SET NULL,
        success BOOLEAN DEFAULT false,
        message_id VARCHAR(255),
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Maintenance schedules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_schedules (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        schedule_type VARCHAR(20) NOT NULL,
        cron_expression VARCHAR(100),
        next_run TIMESTAMP WITH TIME ZONE,
        last_run TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        priority VARCHAR(20) DEFAULT 'medium',
        estimated_duration INTEGER,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Maintenance logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
        performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        parts_used TEXT,
        cost DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        sub_event VARCHAR(50),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Customer accounts table
    await client.query(`
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS meter_readings (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        meter_number VARCHAR(100) NOT NULL,
        reading_date DATE NOT NULL,
        reading_value DECIMAL(10,2) NOT NULL,
        reading_type VARCHAR(20) DEFAULT 'regular',
        units VARCHAR(10) DEFAULT 'gallons',
        recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Billing cycles table
    await client.query(`
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        billing_cycle_id INTEGER REFERENCES billing_cycles(id) ON DELETE SET NULL,
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
    await client.query(`
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
        processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Service requests table
    await client.query(`
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
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id SERIAL PRIMARY KEY,
        service_request_id INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
        work_order_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(20) DEFAULT 'normal',
        status VARCHAR(20) DEFAULT 'open',
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        scheduled_date DATE,
        completed_date DATE,
        estimated_hours DECIMAL(4,2),
        actual_hours DECIMAL(4,2),
        estimated_cost DECIMAL(8,2),
        actual_cost DECIMAL(8,2),
        location TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Leak detection and water loss table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leak_detection (
        id SERIAL PRIMARY KEY,
        location TEXT NOT NULL,
        leak_type VARCHAR(50),
        severity VARCHAR(20) DEFAULT 'minor',
        detected_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'detected',
        estimated_loss_gpd DECIMAL(8,2),
        repair_date DATE,
        repair_cost DECIMAL(8,2),
        repair_notes TEXT,
        coordinates GEOMETRY(POINT, 4326),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Energy consumption table
    await client.query(`
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
        recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Regulatory compliance table
    await client.query(`
      CREATE TABLE IF NOT EXISTS regulatory_compliance (
        id SERIAL PRIMARY KEY,
        regulation_name VARCHAR(255) NOT NULL,
        regulation_type VARCHAR(50) NOT NULL,
        description TEXT,
        compliance_date DATE,
        next_due_date DATE,
        status VARCHAR(20) DEFAULT 'compliant',
        responsible_party INTEGER REFERENCES users(id) ON DELETE SET NULL,
        documentation_path TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database tables:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database pool...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Query helper function
const query = (text: string, params?: any[]) => pool.query(text, params);

export {
  pool,
  testConnection,
  initializeTables,
  query
};
