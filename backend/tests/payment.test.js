// Mock stripe to prevent any real network calls
jest.mock('stripe', () => () => ({
  paymentIntents: {
    create: jest.fn().mockResolvedValue({ id: 'pi_test_123' }),
  },
}));

const request = require('supertest');
const { connect, close, clear } = require('./setup');
let app;
let agent;
const User = require('../models/User');
const Booking = require('../models/Booking');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await connect();
  app = require('../app');
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await clear();
  agent = request.agent(app);
});

describe('Payment validations and flows', () => {
  test('VAL-PAY-001: GET /payment/not-an-id redirects to login when unauthenticated', async () => {
    const res = await request(app).get('/payment/not-an-id');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/login');
  });

  test('VAL-PAY-004: POST /payment/not-an-id/process returns 400 when logged-in', async () => {
    const u = await new User({ name: 'Pay', email: 'pay@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    const res = await agent.post('/payment/not-an-id/process').send({ paymentMethodId: 'pm_test' });
    expect(res.status).toBe(400);
  });

  test('PAYMENT-PROCESS-OK: valid booking processes with mocked Stripe', async () => {
    const u = await new User({ name: 'P', email: 'p@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });

    const booking = await new Booking({
      user: u._id,
      problemCategory: 'Engine',
      description: 'Fix',
      location: { type: 'Point', coordinates: [77.2, 28.6], address: 'A' },
      status: 'completed',
      payment: { status: 'pending', amount: 25 },
    }).save();

    const res = await agent.post(`/payment/${booking._id}/process`).send({ paymentMethodId: 'pm_mock' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('SUBSCRIPTION-PREMIUM-INVALID-PLAN: returns 400', async () => {
    const u = await new User({ name: 'S', email: 's@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    const res = await agent.post('/payment/premium/process').send({ plan: 'weekly', paymentMethodId: 'pm_mock' });
    expect(res.status).toBe(400);
  });

  test('SUBSCRIPTION-PREMIUM-OK: monthly plan succeeds', async () => {
    const u = await new User({ name: 'S2', email: 's2@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    const res = await agent.post('/payment/premium/process').send({ plan: 'monthly', paymentMethodId: 'pm_mock' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
