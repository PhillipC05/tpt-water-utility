const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock the database
jest.mock('../src/database', () => ({
  get: jest.fn(),
  run: jest.fn(),
  all: jest.fn()
}));

const db = require('../src/database');
const { authenticateToken, authorizeRoles } = require('../src/middleware/auth');

describe('Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;

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
      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if malformed authorization header', () => {
      mockReq.headers.authorization = 'Bearer';

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access token required' });
    });

    it('should return 403 for invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    });

    it('should call next for valid token', () => {
      const user = { id: 1, username: 'testuser', role: 'admin' };
      const token = jwt.sign(user, process.env.JWT_SECRET);

      mockReq.headers.authorization = `Bearer ${token}`;

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(user);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authorizeRoles', () => {
    it('should return 403 if user not authorized', () => {
      mockReq.user = { role: 'operator' };
      const middleware = authorizeRoles('admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next if user is authorized', () => {
      mockReq.user = { role: 'admin' };
      const middleware = authorizeRoles('admin', 'operator');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Authentication Routes', () => {
  let app;

  beforeEach(() => {
    // Create a minimal express app for testing
    const express = require('express');
    app = express();
    app.use(express.json());

    // Mock the routes
    app.use('/auth', require('../src/routes/auth'));
  });

  describe('POST /auth/login', () => {
    beforeEach(() => {
      // Mock database calls
      db.get.mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM users WHERE username = ?')) {
          const user = {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            password: bcrypt.hashSync('password123', 10),
            role: 'operator'
          };
          callback(null, user);
        }
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
      db.get.mockImplementation((query, params, callback) => {
        callback(null, null); // No existing user
      });

      db.run.mockImplementation(function(query, params, callback) {
        this.lastID = 1;
        callback(null);
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
      expect(response.body.message).toBe('User registered successfully');
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
