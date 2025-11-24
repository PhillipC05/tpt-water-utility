import { Pool } from 'pg';
import { testConnection, initializeTables } from '../src/database';

// Mock the pg module
jest.mock('pg', () => {
  const mockPool = {
    connect: jest.fn(),
    query: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  };

  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };

  return {
    Pool: jest.fn(() => mockPool),
    __mockPool: mockPool,
    __mockClient: mockClient,
  };
});

const mockPool = (require('pg') as any).__mockPool;
const mockClient = (require('pg') as any).__mockClient;

describe('Database Connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('testConnection', () => {
    it('should return true when database connection is successful', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.release.mockImplementation(() => {});

      const result = await testConnection();

      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return false when database connection fails', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      // Mock console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await testConnection();

      expect(result).toBe(false);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Database connection failed:', error.message);

      consoleSpy.mockRestore();
    });
  });

  describe('initializeTables', () => {
    it('should initialize all tables successfully', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // users table
        .mockResolvedValueOnce({}) // sensors table
        .mockResolvedValueOnce({}) // readings table
        .mockResolvedValueOnce({}) // assets table
        .mockResolvedValueOnce({}) // compliance_standards table
        .mockResolvedValueOnce({}) // treatment_processes table
        .mockResolvedValueOnce({}) // pumps table
        .mockResolvedValueOnce({}) // water_quality table
        .mockResolvedValueOnce({}) // alerts table
        .mockResolvedValueOnce({}) // notification_logs table
        .mockResolvedValueOnce({}) // maintenance_schedules table
        .mockResolvedValueOnce({}) // maintenance_logs table
        .mockResolvedValueOnce({}) // audit_logs table
        .mockResolvedValueOnce({}) // customers table
        .mockResolvedValueOnce({}) // meter_readings table
        .mockResolvedValueOnce({}) // billing_cycles table
        .mockResolvedValueOnce({}) // bills table
        .mockResolvedValueOnce({}) // payments table
        .mockResolvedValueOnce({}) // service_requests table
        .mockResolvedValueOnce({}) // work_orders table
        .mockResolvedValueOnce({}) // leak_detection table
        .mockResolvedValueOnce({}) // energy_consumption table
        .mockResolvedValueOnce({}) // regulatory_compliance table
        .mockResolvedValueOnce({}); // COMMIT

      mockClient.release.mockImplementation(() => {});

      await expect(initializeTables()).resolves.not.toThrow();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const error = new Error('Table creation failed');
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(error); // First table creation fails

      mockClient.release.mockImplementation(() => {});

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(initializeTables()).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(consoleSpy).toHaveBeenCalledWith('Error initializing database tables:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('query function', () => {
    it('should delegate to pool.query', () => {
      const mockQueryResult = { rows: [] };
      mockPool.query.mockResolvedValue(mockQueryResult);

      const { query } = require('../src/database');
      const result = query('SELECT * FROM users', []);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result).toBe(mockPool.query('SELECT * FROM users', []));
    });
  });
});
