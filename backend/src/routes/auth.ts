/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: User's username
 *         password:
 *           type: string
 *           description: User's password
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: Desired username
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           description: User's password
 *         role:
 *           type: string
 *           enum: [admin, operator]
 *           default: operator
 *           description: User's role
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         token:
 *           type: string
 *           description: JWT authentication token
 *         user:
 *           $ref: '#/components/schemas/User'
 */

import express, { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database';
import dotenv from 'dotenv';
import { authenticateToken } from '../middleware/auth';

// Load environment variables
dotenv.config();

const router: Router = express.Router();

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  created_at: string;
}

interface AuthResponse {
  message: string;
  token?: string;
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

// Register
router.post('/register', async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse>) => {
  const { username, email, password, role = 'operator' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, hashedPassword, role]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, username, role },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    res.status(201).json({ message: 'User created successfully', token });
  } catch (error: any) {
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      return res.status(409).json({ message: 'Username or email already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req: Request<{}, AuthResponse, LoginRequest>, res: Response<AuthResponse>) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0] as User;
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'current_password and new_password are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const result = await query('SELECT password FROM users WHERE id = $1', [req.user!.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const isValid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!isValid) return res.status(401).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashed, req.user!.id]);
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
