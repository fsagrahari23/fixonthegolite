const request = require('supertest');
const { connect, close, clear } = require('./setup');

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connect();
  app = require('../app');
});

afterAll(async () => {
  await close();
});

describe('Auth & Guards', () => {
  test('VAL-AUTH-001: login invalid returns 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'no@user.com', password: 'bad' });
    expect(res.status).toBe(400);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/invalid|not\s+registered|incorrect/i);
  });

  test('VAL-GUARD-001: unauthenticated redirected to login', async () => {
    const res = await request(app).get('/user/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });
});
