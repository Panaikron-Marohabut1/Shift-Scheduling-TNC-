import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { databaseOptions, isLocalSchedulingDatabase, isLocalSwapPilotDatabase } from '../src/config';

const original = { url: process.env.DATABASE_URL, ca: process.env.DATABASE_CA_CERT };
afterEach(() => {
  for (const [key, value] of [['DATABASE_URL', original.url], ['DATABASE_CA_CERT', original.ca]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
test('local database tests retain their isolated database and startup settings', () => {
  process.env.DATABASE_URL = 'postgresql://shiftflow_app:fixture@127.0.0.1:54329/tnc_test_fixture';
  const options = databaseOptions();
  assert.equal(options.connectionString, process.env.DATABASE_URL);
  assert.equal(options.ssl, undefined);
  assert.match(options.options!, /timezone=UTC/);
});
test('swap and month-close pilots require a dedicated local database', () => {
  const postgres = 'postgresql://127.0.0.1:54329';
  for (const value of [`${postgres}/tnc_test_123`, `${postgres}/tnc_swap_pilot_123`]) {
    assert.equal(isLocalSwapPilotDatabase(new URL(value)), true);
  }
  for (const value of [`${postgres}/shiftflow_demo`, `${postgres}/tnc_swap_pilot_123?host=other.example.com`,
    'postgresql://db.example.com/tnc_swap_pilot_123', 'https://localhost/tnc_swap_pilot_123']) {
    assert.equal(isLocalSwapPilotDatabase(new URL(value)), false);
  }
});
test('standard scheduling defaults recognize local demo databases only', () => {
  const local = 'postgresql://127.0.0.1:54329';
  for (const name of ['shiftflow_demo', 'tnc_demo_123', 'tnc_swap_pilot_123', 'tnc_test_123']) {
    assert.equal(isLocalSchedulingDatabase(new URL(`${local}/${name}`)), true);
  }
  for (const value of [`${local}/postgres`, `${local}/shiftflow_demo?host=db.example.com`,
    'postgresql://db.example.com/shiftflow_demo']) {
    assert.equal(isLocalSchedulingDatabase(new URL(value)), false);
  }
});
test('cloud database verifies TLS with the trusted CA and no URL override', () => {
  process.env.DATABASE_URL = 'postgresql://tnc_backend_dev.fixture:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=verify-full';
  process.env.DATABASE_CA_CERT = 'config/certs/supabase-prod-ca-2021.crt';
  const options = databaseOptions();
  assert.equal(typeof options.ssl, 'object');
  assert.equal((options.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized, true);
  assert.match(String((options.ssl as { ca: string }).ca), /BEGIN CERTIFICATE/);
  assert.equal(new URL(options.connectionString!).searchParams.has('sslmode'), false);
});
test('cloud database refuses missing CA, weaker TLS, administrator account and other hosts', () => {
  process.env.DATABASE_URL = 'postgresql://tnc_backend_dev.fixture:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
  delete process.env.DATABASE_CA_CERT;
  assert.throws(databaseOptions, /DATABASE_CA_CERT/);
  process.env.DATABASE_CA_CERT = 'config/certs/supabase-prod-ca-2021.crt';
  process.env.DATABASE_URL += '?sslmode=no-verify';
  assert.throws(databaseOptions, /certificate verification/);
  process.env.DATABASE_URL = 'postgresql://tnc_backend_dev.fixture:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?ssl=no-verify';
  assert.throws(databaseOptions, /configure the CA separately/);
  process.env.DATABASE_URL = 'postgresql://postgres.fixture:fixture@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
  assert.throws(databaseOptions, /restricted backend/);
  process.env.DATABASE_URL = 'postgresql://app:fixture@other.example.com:5432/postgres';
  assert.throws(databaseOptions, /restricted to Supabase/);
});
