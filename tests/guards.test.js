const request = require('supertest');
const { connect, close, clear } = require('./setup');
let app;
const User = require('../models/User');

describe('Route guards', () => {
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

  test('GUARD-USER: user can access /user routes after login', async () => {
    const u = await new User({ name: 'U', email: 'u@example.com', password: 'p@ssw0rd', role: 'user' }).save();
    const login = await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    expect(login.status).toBe(200);

    const res = await agent.get('/user/book');
    // route renders page behind guard; should not redirect to /auth/login
    expect(res.status).toBe(200);
  });

  test('GUARD-MECHANIC: mechanic without approval redirected to pending approval', async () => {
    const m = await new User({ name: 'M', email: 'm@example.com', password: 'p@ssw0rd', role: 'mechanic', isApproved: false }).save();
    const login = await agent.post('/auth/login').send({ email: m.email, password: 'p@ssw0rd' });
    expect(login.status).toBe(200);

    const res = await agent.get('/mechanic/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/auth/pending-approval');
  });

  test('GUARD-ADMIN: non-admin cannot access admin routes', async () => {
    const u = await new User({ name: 'U2', email: 'u2@example.com', password: 'p@ssw0rd', role: 'user' }).save();
    const login = await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    expect(login.status).toBe(200);

    const res = await agent.get('/admin/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});
