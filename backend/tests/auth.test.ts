 import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express, { Request, Response, NextFunction } from 'express';

// Mock the database
jest.mock('../src/database', () => ({
  query: jest.fn()
}));

import { query } from '../src/database';
import { authenticateToken, authorizeRoles } from '../src/middleware/auth';

interface MockRequest {
  headers: { [key: string]: string | undefined };
  user?: any;
}

interface MockResponse {
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(data: any) => void>;
}

interface MockNext {
  (): void;
}

interface MockQueryResult {
  rows: any[];
  command?: string;
  rowCount?: number;
  oid?: number;
  fields?: any[];
}

describe('Authentication Middleware', () => {
  let mockReq: MockRequest;
  let mockRes: MockResponse;
  let mockNext: MockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should return 401 if no authorization header', () => {
      authenticateToken(mockReq as Request, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if malformed authorization header', () => {
      mockReq.headers.authorization = 'Bearer';

      authenticateToken(mockReq as Request, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access token required' });
    });

    it('should return 403 for invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';

      authenticateToken(mockReq as Request, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    });

    it('should call next for valid token', () => {
      const user = { id: 1, username: 'testuser', role: 'admin' };
      const token = jwt.sign(user, process.env.JWT_SECRET || 'test_secret');

      mockReq.headers.authorization = `Bearer ${token}`;

      authenticateToken(mockReq as Request, mockRes as any, mockNext);

      expect(mockReq.user).toEqual(user);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authorizeRoles', () => {
    it('should return 403 if user not authorized', () => {
      mockReq.user = { role: 'operator' };
      const middleware = authorizeRoles('admin');

      middleware(mockReq as Request, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next if user is authorized', () => {
      mockReq.user = { role: 'admin' };
      const middleware = authorizeRoles('admin', 'operator');

      middleware(mockReq as Request, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Authentication Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a minimal express app for testing
    app = express();
    app.use(express.json());

    // Mock the routes - import the TypeScript version
    import('../src/routes/auth').then(authRoutes => {
      app.use('/auth', authRoutes.default);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(() => {
      // Mock database calls
      (query as jest.MockedFunction<typeof query>).mockImplementation(async (text: string, params?: any[]) => {
        if (text.includes('SELECT * FROM users WHERE username = $1')) {
          const user = {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            password: bcrypt.hashSync('password123', 10),
            role: 'operator'
          };
          return { rows: [user] };
        }
        return { rows: [] };
      });
    });

    it('should return token for valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('testuser');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/register', () => {
    beforeEach(() => {
      (query as jest.MockedFunction<typeof query>).mockImplementation(async (text: string, params?: any[]) => {
        if (text.includes('SELECT * FROM users WHERE username = $1')) {
          return { rows: [] }; // No existing user
        }
        if (text.includes('INSERT INTO users')) {
          return { rows: [{ id: 1 }] }; // Return inserted user ID
        }
        return { rows: [] };
      });
    });

    it('should create new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.message).toBe('User created successfully');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'newuser'
          // missing email and password
        });

      expect(response.status).toBe(400);
    });
  });
});
