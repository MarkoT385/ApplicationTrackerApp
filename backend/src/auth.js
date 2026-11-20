import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'auth_token';
const TOKEN_TTL_SECONDS = 60 * 60;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

function cookieOptions(secure, includeMaxAge = true) {
  const options = {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
  };
  if (includeMaxAge) {
    options.maxAge = TOKEN_TTL_SECONDS * 1000;
  }
  return options;
}

export function requireAuth(jwtSecret) {
  return (req, res, next) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.userId = payload.sub;
      return next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      return next(error);
    }
  };
}

export function createAuthRouter({ pool, jwtSecret, cookieSecure }) {
  const router = Router();
  const authenticated = requireAuth(jwtSecret);

  router.post('/signup', async (req, res, next) => {
    const { username, email, password } = req.body ?? {};
    if (
      typeof username !== 'string' ||
      !USERNAME_PATTERN.test(username) ||
      typeof email !== 'string' ||
      email.length > 254 ||
      !EMAIL_PATTERN.test(email) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        error: 'Enter a valid username, email, and password (8-72 bytes).',
      });
    }

    try {
      const normalizedUsername = username.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const passwordHash = await bcrypt.hash(password, 12);
      const [result] = await pool.execute(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [normalizedUsername, normalizedEmail, passwordHash],
      );
      const user = {
        id: result.insertId,
        username: normalizedUsername,
        email: normalizedEmail,
      };
      const token = jwt.sign({}, jwtSecret, {
        subject: String(user.id),
        expiresIn: TOKEN_TTL_SECONDS,
      });
      res.cookie(COOKIE_NAME, token, cookieOptions(cookieSecure));
      return res.status(201).json({ user });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username or email is already in use.' });
      }
      return next(error);
    }
  });

  router.post('/login', async (req, res, next) => {
    const { identifier, password } = req.body ?? {};
    if (
      typeof identifier !== 'string' ||
      typeof password !== 'string' ||
      identifier.length === 0 ||
      password.length === 0
    ) {
      return res.status(400).json({ error: 'Enter your username or email and password.' });
    }

    try {
      const normalizedIdentifier = identifier.trim();
      const [rows] = await pool.execute(
        'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1',
        [normalizedIdentifier, normalizedIdentifier.toLowerCase()],
      );
      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid username/email or password.' });
      }

      const token = jwt.sign({}, jwtSecret, {
        subject: String(user.id),
        expiresIn: TOKEN_TTL_SECONDS,
      });
      res.cookie(COOKIE_NAME, token, cookieOptions(cookieSecure));
      return res.json({ user: publicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions(cookieSecure, false));
    return res.status(204).end();
  });

  router.get('/me', authenticated, async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, email FROM users WHERE id = ? LIMIT 1',
        [req.userId],
      );
      if (!rows[0]) {
        res.clearCookie(COOKIE_NAME, cookieOptions(cookieSecure, false));
        return res.status(401).json({ error: 'Authentication required.' });
      }
      return res.json({ user: publicUser(rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
