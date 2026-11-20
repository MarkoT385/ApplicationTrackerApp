import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
const users = [];
const stages = [];
let nextId = 1;
let nextStageId = 1;
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
    if (query.startsWith('INSERT INTO stages')) {
      for (let index = 0; index < values.length; index += 3) {
        stages.push({ id: nextStageId++, user_id: Number(values[index]), name: values[index + 1], position: values[index + 2] });
      }
      return [{ affectedRows: values.length / 3 }];
    }
    if (query.includes('SELECT COALESCE(MAX(position)')) {
      const userStages = stages.filter((stage) => stage.user_id === Number(values[0]));
      return [[{ position: userStages.length ? Math.max(...userStages.map((stage) => stage.position)) + 1 : 0 }]];
    }
    if (query.startsWith('SELECT id, name, position FROM stages WHERE user_id')) {
      return [stages
        .filter((stage) => stage.user_id === Number(values[0]))
        .sort((left, right) => left.position - right.position || left.id - right.id)
        .map(({ id, name, position }) => ({ id, name, position }))];
    }
    if (query.startsWith('SELECT id, name, position FROM stages WHERE id')) {
      return [stages
        .filter((stage) => stage.id === Number(values[0]) && stage.user_id === Number(values[1]))
        .map(({ id, name, position }) => ({ id, name, position }))];
    }
    if (query.startsWith('UPDATE stages')) {
      const stage = stages.find((item) => item.id === Number(values[1]) && item.user_id === Number(values[2]));
      if (stage && stages.some((item) => item.user_id === stage.user_id && item.id !== stage.id && item.name.toLowerCase() === values[0].toLowerCase())) {
        const error = new Error('Duplicate stage');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      if (stage) stage.name = values[0];
      return [{ affectedRows: stage ? 1 : 0 }];
    }
    if (query.startsWith('DELETE FROM stages')) {
      const index = stages.findIndex((stage) => stage.id === Number(values[0]) && stage.user_id === Number(values[1]));
      if (index >= 0) stages.splice(index, 1);
      return [{ affectedRows: index >= 0 ? 1 : 0 }];
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
  stages.length = 0;
  nextId = 1;
  nextStageId = 1;
});

after(() => {
  users.length = 0;
  stages.length = 0;
});

test('signup hashes the password and creates a session', async () => {
  const response = await request(app)
    .post('/api/auth/signup')
    .send({ username: 'jane_doe', email: 'Jane@example.com', password: 'a-strong-password' });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.email, 'jane@example.com');
  assert.notEqual(users[0].password_hash, 'a-strong-password');
  assert.equal(await bcrypt.compare('a-strong-password', users[0].password_hash), true);
  assert.deepEqual(stages.filter((stage) => stage.user_id === users[0].id).map((stage) => stage.name), [
    'Saved', 'Applied', 'Interview', 'Offer', 'Rejected',
  ]);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/);
});

test('users can create, rename, delete, and reload their own stages', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup')
    .send({ username: 'stage_user', email: 'stages@example.com', password: 'a-strong-password' })
    .expect(201);

  const initial = await agent.get('/api/stages').expect(200);
  assert.deepEqual(initial.body.stages.map((stage) => stage.name), [
    'Saved', 'Applied', 'Interview', 'Offer', 'Rejected',
  ]);

  const created = await agent.post('/api/stages').send({ name: 'Phone Screen' }).expect(201);
  assert.equal(created.body.stage.name, 'Phone Screen');
  const renamed = await agent.patch(`/api/stages/${created.body.stage.id}`).send({ name: 'Screening' }).expect(200);
  assert.equal(renamed.body.stage.name, 'Screening');
  const afterRename = await agent.get('/api/stages').expect(200);
  assert.equal(afterRename.body.stages.some((stage) => stage.name === 'Screening'), true);
  await agent.delete(`/api/stages/${created.body.stage.id}`).expect(204);

  const refreshed = await agent.get('/api/stages').expect(200);
  assert.equal(refreshed.body.stages.some((stage) => stage.name === 'Screening'), false);
  await request(app).get('/api/stages').expect(401);
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
