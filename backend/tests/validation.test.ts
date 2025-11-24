import Joi from 'joi';
import {
  authSchemas,
  sensorSchemas,
  assetSchemas,
  readingSchemas,
  alertSchemas,
  customerSchemas,
  querySchemas,
} from '../src/validation/schemas';
import { validate, ValidationError } from '../src/validation/middleware';

describe('Validation Schemas', () => {
  describe('Authentication Schemas', () => {
    describe('login schema', () => {
      it('should validate valid login data', () => {
        const validData = {
          username: 'testuser',
          password: 'password123',
        };

        const { error } = authSchemas.login.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid username format', () => {
        const invalidData = {
          username: 'test user', // spaces not allowed
          password: 'password123',
        };

        const { error } = authSchemas.login.validate(invalidData);
        expect(error).toBeDefined();
        expect(error?.details?.[0]?.message).toContain('Username can only contain');
      });

      it('should reject short password', () => {
        const invalidData = {
          username: 'testuser',
          password: '123', // too short
        };

        const { error } = authSchemas.login.validate(invalidData);
        expect(error).toBeDefined();
      });
    });

    describe('register schema', () => {
      it('should validate valid registration data', () => {
        const validData = {
          username: 'newuser',
          email: 'user@example.com',
          password: 'Password123!',
          role: 'operator',
        };

        const { error } = authSchemas.register.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject weak password', () => {
        const invalidData = {
          username: 'newuser',
          email: 'user@example.com',
          password: 'password', // no uppercase, no number
        };

        const { error } = authSchemas.register.validate(invalidData);
        expect(error).toBeDefined();
        expect(error?.details?.[0]?.message).toContain('must contain at least one lowercase');
      });

      it('should reject invalid email', () => {
        const invalidData = {
          username: 'newuser',
          email: 'not-an-email',
          password: 'Password123!',
        };

        const { error } = authSchemas.register.validate(invalidData);
        expect(error).toBeDefined();
      });
    });
  });

  describe('Sensor Schemas', () => {
    describe('create schema', () => {
      it('should validate valid sensor data', () => {
        const validData = {
          name: 'Temperature Sensor 1',
          type: 'temperature',
          location: 'Main Building',
          status: 'active',
        };

        const { error } = sensorSchemas.create.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid sensor type', () => {
        const invalidData = {
          name: 'Test Sensor',
          type: 'invalid_type',
          location: 'Test Location',
        };

        const { error } = sensorSchemas.create.validate(invalidData);
        expect(error).toBeDefined();
      });
    });
  });

  describe('Asset Schemas', () => {
    describe('create schema', () => {
      it('should validate valid asset data', () => {
        const validData = {
          name: 'Main Pump',
          type: 'pump',
          location: 'Pump Station A',
          status: 'operational',
          installation_date: '2023-01-15',
        };

        const { error } = assetSchemas.create.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid maintenance dates', () => {
        const invalidData = {
          name: 'Test Asset',
          type: 'pump',
          installation_date: '2023-01-15',
          last_maintenance: '2023-01-10', // before installation
          next_maintenance: '2023-01-20',
        };

        const { error } = assetSchemas.create.validate(invalidData);
        expect(error).toBeDefined();
      });
    });
  });

  describe('Reading Schemas', () => {
    describe('create schema', () => {
      it('should validate valid reading data', () => {
        const validData = {
          sensor_id: 1,
          value: 23.5,
          unit: 'celsius',
          timestamp: '2023-01-15T10:30:00Z',
        };

        const { error } = readingSchemas.create.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should set default timestamp', () => {
        const dataWithoutTimestamp = {
          sensor_id: 1,
          value: 23.5,
          unit: 'celsius',
        };

        const { error, value } = readingSchemas.create.validate(dataWithoutTimestamp);
        expect(error).toBeUndefined();
        expect(value.timestamp).toBeDefined();
      });
    });

    describe('bulk create schema', () => {
      it('should validate array of readings', () => {
        const validData = [
          {
            sensor_id: 1,
            value: 23.5,
            unit: 'celsius',
          },
          {
            sensor_id: 2,
            value: 15.2,
            unit: 'liters',
          },
        ];

        const { error } = readingSchemas.bulkCreate.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject empty array', () => {
        const invalidData: any[] = [];

        const { error } = readingSchemas.bulkCreate.validate(invalidData);
        expect(error).toBeDefined();
      });
    });
  });

  describe('Customer Schemas', () => {
    describe('create schema', () => {
      it('should validate valid customer data', () => {
        const validData = {
          account_number: 'ACC001',
          customer_name: 'John Doe',
          service_address: '123 Main St, City, State',
          phone: '+1-555-0123',
          email: 'john@example.com',
          service_type: 'residential',
        };

        const { error } = customerSchemas.create.validate(validData);
        expect(error).toBeUndefined();
      });

      it('should reject invalid phone format', () => {
        const invalidData = {
          account_number: 'ACC001',
          customer_name: 'John Doe',
          service_address: '123 Main St',
          phone: 'invalid-phone',
        };

        const { error } = customerSchemas.create.validate(invalidData);
        expect(error).toBeDefined();
        expect(error?.details?.[0]?.message).toContain('Phone number format is invalid');
      });
    });
  });

  describe('Query Schemas', () => {
    describe('pagination schema', () => {
      it('should validate valid pagination', () => {
        const validData = {
          page: 2,
          limit: 50,
          sort: 'created_at:desc',
        };

        const { error, value } = querySchemas.pagination.validate(validData);
        expect(error).toBeUndefined();
        expect(value.page).toBe(2);
        expect(value.limit).toBe(50);
      });

      it('should set default values', () => {
        const minimalData = {};

        const { error, value } = querySchemas.pagination.validate(minimalData);
        expect(error).toBeUndefined();
        expect(value.page).toBe(1);
        expect(value.limit).toBe(50);
      });

      it('should reject invalid sort format', () => {
        const invalidData = {
          sort: 'invalid-sort-format',
        };

        const { error } = querySchemas.pagination.validate(invalidData);
        expect(error).toBeDefined();
      });
    });
  });
});

describe('Validation Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('validate function', () => {
    it('should call next on valid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer().min(0),
      });

      mockReq.body = { name: 'John', age: 25 };

      const middleware = validate(schema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.validatedData).toEqual({ name: 'John', age: 25 });
    });

    it('should call next with ValidationError on invalid data', () => {
      const schema = Joi.object({
        email: Joi.string().email().required(),
      });

      mockReq.body = { email: 'invalid-email' };

      const middleware = validate(schema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockReq.validatedData).toBeUndefined();
    });
  });

  describe('ValidationError class', () => {
    it('should create error with correct properties', () => {
      const details = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError('Validation failed', details);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
      expect(error.name).toBe('ValidationError');
    });
  });
});
