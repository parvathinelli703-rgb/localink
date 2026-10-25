import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { hashPassword, comparePassword, signToken } from '../utils/auth';
import { success, error } from '../utils/response';
import { registerSchema, loginSchema } from '../utils/validation';

export async function register(req: AuthRequest, res: Response) {
  try {
    const body = registerSchema.parse(req.body);

    // Check existing email
    const existing: any[] = await query(
      'SELECT id FROM users WHERE email = ?',
      [body.email]
    );
    if (existing.length > 0) {
      return error(res, 'EMAIL_EXISTS', 'Email already registered', 409);
    }

    const passwordHash = await hashPassword(body.password);

    const result: any = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, role)
       VALUES (?, ?, ?, ?, ?)`,
      [body.email, passwordHash, body.fullName, body.phone || null, body.role]
    );

    const userId = result.insertId;

    // If provider, create empty provider profile (location will be set later)
    if (body.role === 'provider') {
      // Default location (Delhi center as placeholder - must be updated)
      await query(
        `INSERT INTO providers (user_id, location, is_approved)
         VALUES (?, ST_GeomFromText('POINT(77.2090 28.6139)', 4326), 0)`,
        [userId]
      );
    }

    const token = signToken({
      userId,
      role: body.role,
      email: body.email,
    });

    return success(
      res,
      {
        token,
        user: {
          id: userId,
          email: body.email,
          fullName: body.fullName,
          role: body.role,
        },
      },
      201
    );
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return error(res, 'VALIDATION_ERROR', 'Invalid input', 400, err.errors);
    }
    console.error('Register error:', err);
    return error(res, 'INTERNAL_ERROR', 'Registration failed', 500);
  }
}

export async function login(req: AuthRequest, res: Response) {
  try {
    const body = loginSchema.parse(req.body);

    const users: any[] = await query(
      'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ?',
      [body.email]
    );

    if (users.length === 0) {
      return error(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const user = users[0];
    if (!user.is_active) {
      return error(res, 'ACCOUNT_DISABLED', 'Account is disabled', 403);
    }

    if (!user.password_hash) {
      return error(res, 'INVALID_CREDENTIALS', 'Please use social login', 401);
    }

    const valid = await comparePassword(body.password, user.password_hash);
    if (!valid) {
      return error(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    return success(res, {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return error(res, 'VALIDATION_ERROR', 'Invalid input', 400, err.errors);
    }
    console.error('Login error:', err);
    return error(res, 'INTERNAL_ERROR', 'Login failed', 500);
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const users: any[] = await query(
      `SELECT id, email, full_name, phone, role, avatar_url, is_verified, created_at
       FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return error(res, 'NOT_FOUND', 'User not found', 404);
    }

    const user = users[0];

    // If provider, attach provider profile
    let provider = null;
    if (user.role === 'provider') {
      const providers: any[] = await query(
        `SELECT id, business_name, bio, experience_years, is_online, is_approved,
                ST_X(location) as lng, ST_Y(location) as lat,
                address, service_radius_km, rating_avg, rating_count, completed_jobs
         FROM providers WHERE user_id = ?`,
        [user.id]
      );
      if (providers.length > 0) {
        provider = providers[0];
      }
    }

    return success(res, { user, provider });
  } catch (err) {
    console.error('Me error:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to fetch profile', 500);
  }
}
