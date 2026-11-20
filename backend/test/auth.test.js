import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
const users = [];
let nextId = 1;
const pool = {
  async execute(query, values) {
    if (query.startsWith('INSERT INTO users')) {
      const [username, email, passwordHash] = values;
      if (users.some((user) => user.username === username || user.email === email)) {
        const error = new Error('Duplicate user');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      const user = { id: nextId++, username, email, password_hash: passwordHash };
      users.push(user);
      return [{ insertId: user.id }];
    }
    if (query.includes('WHERE username = ? OR email = ?')) {
      return [users.filter((user) => (
        user.username === values[0] || user.email === values[1]
      ))];
    }
    if (query.includes('WHERE id = ?')) {
      return [users.filter((user) => user.id === Number(values[0]))];
    }
    throw new Error(`Unexpected query: ${query}`);
  },
};

const app = createApp({ pool, jwtSecret: JWT_SECRET });

before(() => {
  users.length = 0;
  nextId = 1;
});

after(() => {
  users.length = 0;
});

test('signup hashes the password and creates a session', async () => {
  const response = await request(app)
    .post('/api/auth/signup')
    .send({ username: 'jane_doe', email: 'Jane@example.com', password: 'a-strong-password' });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'jane@example.com');
  assert.notEqual(users[0].password_hash, 'a-strong-password');
  assert.equal(await bcrypt.compare('a-strong-password', users[0].password_hash), true);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
});

test('login accepts an email and rejects an incorrect password', async () => {
  const valid = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'jane@example.com', password: 'a-strong-password' });
  const invalid = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'jane@example.com', password: 'wrong-password' });

  assert.equal(valid.status, 200);
  assert.equal(invalid.status, 401);
  assert.match(invalid.body.error, /Invalid/);
});

test('private routes reject logged-out users and accept an authenticated user', async () => {
  const loggedOut = await request(app).get('/api/auth/me');
  const loggedIn = await request(app)
    .get('/api/auth/me')
    .set('Cookie', (await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'jane_doe', password: 'a-strong-password' }))
      .headers['set-cookie']);
  const privateApplications = await request(app).get('/api/applications');

  assert.equal(loggedOut.status, 401);
  assert.equal(loggedIn.status, 200);
  assert.equal(privateApplications.status, 401);
});

test('signup validates credentials and prevents duplicate accounts', async () => {
  const invalid = await request(app)
    .post('/api/auth/signup')
    .send({ username: 'jo', email: 'not-an-email', password: 'short' });
  const duplicate = await request(app)
    .post('/api/auth/signup')
    .send({ username: 'jane_doe', email: 'another@example.com', password: 'a-strong-password' });

  assert.equal(invalid.status, 400);
  assert.equal(duplicate.status, 409);
});

test('logout clears the authentication cookie', async () => {
  await request(app)
    .post('/api/auth/signup')
    .send({ username: 'john_test', email: 'john@example.com', password: 'another-strong-password' })
    .expect(201);
  const agent = request.agent(app);
  await agent.post('/api/auth/login')
    .send({ identifier: 'john_test', password: 'another-strong-password' })
    .expect(200);
  await agent.get('/api/auth/me').expect(200);
  await agent.post('/api/auth/logout').expect(204);
  await agent.get('/api/auth/me').expect(401);
});
