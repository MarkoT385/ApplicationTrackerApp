import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPoolConfig } from '../src/db.js';

test('database config uses the Cloud SQL Unix socket when configured', () => {
  const config = createPoolConfig({
    DB_NAME: 'tracker',
    DB_USER: 'app',
    DB_PASSWORD: 'secret',
    DB_SOCKET_PATH: '/cloudsql/project:region:instance',
    DB_HOST: 'ignored-host',
  });

  assert.equal(config.socketPath, '/cloudsql/project:region:instance');
  assert.equal('host' in config, false);
  assert.equal('port' in config, false);
});

test('database config uses TCP for local MySQL when no socket is configured', () => {
  const config = createPoolConfig({ DB_HOST: 'database', DB_PORT: '3307' });

  assert.equal(config.host, 'database');
  assert.equal(config.port, 3307);
  assert.equal('socketPath' in config, false);
});
