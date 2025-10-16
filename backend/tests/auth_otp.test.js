const request = require('supertest');
const { connect, close, clear } = require('./setup');

// Mock OTP service to avoid sending emails and to make OTP deterministic
jest.mock('../services/otpService', () => ({
  generateOtp: () => '123456',
  sendOtp: jest.fn().mockResolvedValue(),
}));

let app;
const User = require('../models/User');

describe('Auth & OTP flows', () => {
  let agent;

  beforeAll(async () => {
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

  test('AUTH-LOGIN-200: successful login returns JSON and sets session', async () => {
    const email = 'user1@example.com';
    const password = 'secret123';
    await new User({ name: 'User One', email, password, role: 'user' }).save();

    const res = await agent.post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Login successful');
    expect(res.body).toHaveProperty('user.email', email);
    // cookie set for session
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('AUTH-REGISTER-OTP-FLOW: register -> verify OTP creates user', async () => {
    const email = 'newuser@example.com';
    const register = await agent
      .post('/auth/register')
      .send({ name: 'New User', email, password: 'pass1234', phone: '9999999999' });
    expect(register.status).toBe(302);
    expect(register.headers.location).toBe('/auth/verify-otp');

    const verify = await agent.post('/auth/verify-otp').send({ otp: '123456' });
    expect(verify.status).toBe(302);
    expect(verify.headers.location).toBe('/auth/login');

    const created = await User.findOne({ email });
    expect(created).toBeTruthy();
    expect(created.name).toBe('New User');
  });

  test('OTP-VERIFY-INVALID: wrong OTP redirects back to verify page', async () => {
    const email = 'otpuser@example.com';
    await agent
      .post('/auth/register')
      .send({ name: 'Otp User', email, password: 'pass1234' });

    const bad = await agent.post('/auth/verify-otp').send({ otp: '000000' });
    expect(bad.status).toBe(302);
    expect(bad.headers.location).toBe('/auth/verify-otp');
  });
});
