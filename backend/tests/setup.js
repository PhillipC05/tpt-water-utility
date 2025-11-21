// Test setup file
process.env.NODE_ENV = 'test';
process.env.DB_PATH = './database/test_water_utility.db';
process.env.JWT_SECRET = 'test_jwt_secret';

// Mock external services for testing
jest.mock('../src/notification-service');
jest.mock('../src/audit-service');

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
