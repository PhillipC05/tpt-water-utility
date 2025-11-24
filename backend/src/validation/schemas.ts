import Joi from 'joi';

// Auth validation schemas
export const authSchemas = {
  login: Joi.object({
    username: Joi.string()
      .min(3)
      .max(50)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      }),

    password: Joi.string()
      .min(6)
      .max(100)
      .required(),
  }),

  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(50)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
      }),

    email: Joi.string()
      .email()
      .max(255)
      .required(),

    password: Joi.string()
      .min(8)
      .max(100)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      }),

    role: Joi.string()
      .valid('admin', 'operator')
      .default('operator'),
  }),
};

// Sensor validation schemas
export const sensorSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .required(),

    type: Joi.string()
      .valid('flow', 'pressure', 'level', 'quality', 'temperature', 'ph', 'turbidity', 'chlorine', 'conductivity')
      .required(),

    location: Joi.string()
      .max(255)
      .allow('', null),

    status: Joi.string()
      .valid('active', 'inactive', 'maintenance')
      .default('active'),
  }),

  update: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100),

    type: Joi.string()
      .valid('flow', 'pressure', 'level', 'quality', 'temperature', 'ph', 'turbidity', 'chlorine', 'conductivity'),

    location: Joi.string()
      .max(255)
      .allow('', null),

    status: Joi.string()
      .valid('active', 'inactive', 'maintenance'),
  }).min(1), // At least one field must be provided
};

// Asset validation schemas
export const assetSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .required(),

    type: Joi.string()
      .valid('pump', 'valve', 'pipe', 'tank', 'filter', 'sensor', 'treatment_unit', 'other')
      .required(),

    location: Joi.string()
      .max(255)
      .allow('', null),

    status: Joi.string()
      .valid('operational', 'maintenance', 'offline', 'faulty')
      .default('operational'),

    installation_date: Joi.date()
      .iso()
      .allow(null),

    last_maintenance: Joi.date()
      .iso()
      .allow(null),

    next_maintenance: Joi.date()
      .iso()
      .allow(null)
      .when('last_maintenance', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('last_maintenance')),
      }),
  }),

  update: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100),

    type: Joi.string()
      .valid('pump', 'valve', 'pipe', 'tank', 'filter', 'sensor', 'treatment_unit', 'other'),

    location: Joi.string()
      .max(255)
      .allow('', null),

    status: Joi.string()
      .valid('operational', 'maintenance', 'offline', 'faulty'),

    installation_date: Joi.date()
      .iso()
      .allow(null),

    last_maintenance: Joi.date()
      .iso()
      .allow(null),

    next_maintenance: Joi.date()
      .iso()
      .allow(null)
      .when('last_maintenance', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('last_maintenance')),
      }),
  }).min(1),
};

// Reading validation schemas
export const readingSchemas = {
  create: Joi.object({
    sensor_id: Joi.number()
      .integer()
      .positive()
      .required(),

    value: Joi.number()
      .precision(4)
      .required(),

    unit: Joi.string()
      .max(20)
      .allow('', null),

    timestamp: Joi.date()
      .iso()
      .default(() => new Date()),
  }),

  bulkCreate: Joi.array().items(
    Joi.object({
      sensor_id: Joi.number()
        .integer()
        .positive()
        .required(),

      value: Joi.number()
        .precision(4)
        .required(),

      unit: Joi.string()
        .max(20)
        .allow('', null),

      timestamp: Joi.date()
        .iso()
        .default(() => new Date()),
    })
  ).min(1).max(1000), // Limit bulk operations
};

// Alert validation schemas
export const alertSchemas = {
  create: Joi.object({
    type: Joi.string()
      .valid('threshold_exceeded', 'sensor_offline', 'maintenance_due', 'system_error', 'custom')
      .required(),

    message: Joi.string()
      .min(1)
      .max(1000)
      .required(),

    severity: Joi.string()
      .valid('low', 'medium', 'high', 'critical')
      .default('medium'),

    sensor_id: Joi.number()
      .integer()
      .positive()
      .allow(null),
  }),

  update: Joi.object({
    status: Joi.string()
      .valid('active', 'acknowledged', 'resolved'),

    severity: Joi.string()
      .valid('low', 'medium', 'high', 'critical'),
  }).min(1),
};

// Customer validation schemas
export const customerSchemas = {
  create: Joi.object({
    account_number: Joi.string()
      .min(1)
      .max(50)
      .required(),

    customer_name: Joi.string()
      .min(1)
      .max(255)
      .required(),

    service_address: Joi.string()
      .min(1)
      .max(500)
      .required(),

    mailing_address: Joi.string()
      .max(500)
      .allow('', null),

    phone: Joi.string()
      .pattern(/^\+?[\d\s\-\(\)]+$/)
      .max(20)
      .allow('', null)
      .messages({
        'string.pattern.base': 'Phone number format is invalid',
      }),

    email: Joi.string()
      .email()
      .max(255)
      .allow('', null),

    account_status: Joi.string()
      .valid('active', 'inactive', 'suspended')
      .default('active'),

    service_type: Joi.string()
      .valid('residential', 'commercial', 'industrial', 'municipal')
      .default('residential'),

    meter_number: Joi.string()
      .max(100)
      .allow('', null),

    meter_size: Joi.string()
      .max(20)
      .allow('', null),

    installation_date: Joi.date()
      .iso()
      .allow(null),
  }),

  update: Joi.object({
    customer_name: Joi.string()
      .min(1)
      .max(255),

    service_address: Joi.string()
      .min(1)
      .max(500),

    mailing_address: Joi.string()
      .max(500)
      .allow('', null),

    phone: Joi.string()
      .pattern(/^\+?[\d\s\-\(\)]+$/)
      .max(20)
      .allow('', null)
      .messages({
        'string.pattern.base': 'Phone number format is invalid',
      }),

    email: Joi.string()
      .email()
      .max(255)
      .allow('', null),

    account_status: Joi.string()
      .valid('active', 'inactive', 'suspended'),

    service_type: Joi.string()
      .valid('residential', 'commercial', 'industrial', 'municipal'),

    meter_number: Joi.string()
      .max(100)
      .allow('', null),

    meter_size: Joi.string()
      .max(20)
      .allow('', null),

    installation_date: Joi.date()
      .iso()
      .allow(null),
  }).min(1),
};

// Query parameter validation
export const querySchemas = {
  pagination: Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),

    limit: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .default(50),

    sort: Joi.string()
      .pattern(/^[a-zA-Z_]+:(asc|desc)$/)
      .allow('', null)
      .messages({
        'string.pattern.base': 'Sort must be in format: field:direction (e.g., created_at:desc)',
      }),
  }),

  dateRange: Joi.object({
    start_date: Joi.date()
      .iso(),

    end_date: Joi.date()
      .iso()
      .when('start_date', {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref('start_date')),
      }),
  }),
};
