const request = require('supertest');
const { connect, close, clear } = require('./setup');
let app;
const User = require('../models/User');
const Booking = require('../models/Booking');

describe('User booking validations and actions', () => {
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

  async function loginAs(email, role = 'user') {
    const password = 'p@ssw0rd';
    await new User({ name: email.split('@')[0], email, password, role }).save();
    const res = await agent.post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
  }

  test('BOOK-VAL-LOC-INVALID: invalid coords cause redirect back to book page', async () => {
    await loginAs('loc@test.com');
    const res = await agent
      .post('/user/book')
      .send({
        problemCategory: 'Engine',
        description: 'Won\'t start',
        address: 'Somewhere',
        latitude: '0',
        longitude: '0',
      });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/user/book');
  });

  test('BOOK-VAL-TOWING-DROPOFF-INVALID: invalid towing dropoff coords redirect', async () => {
    await loginAs('tow@test.com');
    const res = await agent
      .post('/user/book')
      .send({
        problemCategory: 'Engine',
        description: 'Noise',
        address: 'Addr',
        latitude: '28.6',
        longitude: '77.2',
        requiresTowing: 'on',
        dropoffLatitude: '999',
        dropoffLongitude: '999',
        dropoffAddress: 'Shop',
      });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/user/book');
  });

  test('BOOK-DETAILS-UNAUTHORIZED: user cannot view another user\'s booking', async () => {
    const owner = await new User({ name: 'Owner', email: 'owner@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    const other = await new User({ name: 'Other', email: 'other@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    const booking = await new Booking({
      user: owner._id,
      problemCategory: 'Brakes',
      description: 'Squeak',
      location: { type: 'Point', coordinates: [77.2, 28.6], address: 'Place' },
    }).save();

    const login = await agent.post('/auth/login').send({ email: other.email, password: 'p@ssw0rd' });
    expect(login.status).toBe(200);

    const res = await agent.get(`/user/booking/${booking._id}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/user/dashboard');
  });

  test('BOOK-CANCEL-INVALID-STATE: cannot cancel when not pending/accepted', async () => {
    const u = await new User({ name: 'U', email: 'u@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    const booking = await new Booking({
      user: u._id,
      problemCategory: 'Tyre',
      description: 'Flat',
      status: 'in-progress',
      location: { type: 'Point', coordinates: [77.2, 28.6], address: 'Place' },
    }).save();

    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    const res = await agent.post(`/user/booking/${booking._id}/cancel`).send();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/user/booking/${booking._id}`);
  });

  test('BOOK-RATE-VALIDATION: missing rating -> 400', async () => {
    const u = await new User({ name: 'U', email: 'rate@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    const booking = await new Booking({
      user: u._id,
      problemCategory: 'Lights',
      description: 'Dim',
      location: { type: 'Point', coordinates: [77.2, 28.6], address: 'Place' },
      payment: { status: 'completed', amount: 10 },
      status: 'completed',
    }).save();

    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    const res = await agent.post(`/user/booking/${booking._id}/rate`).send({ comment: 'ok' });
    expect(res.status).toBe(400);
  });

  test('BOOK-RATE-NOT-ALLOWED: cannot rate until service completed and paid', async () => {
    const u = await new User({ name: 'U', email: 'rate2@test.com', password: 'p@ssw0rd', role: 'user' }).save();
    const booking = await new Booking({
      user: u._id,
      problemCategory: 'Chain',
      description: 'Loose',
      location: { type: 'Point', coordinates: [77.2, 28.6], address: 'Place' },
      payment: { status: 'pending', amount: 10 },
      status: 'in-progress',
    }).save();

    await agent.post('/auth/login').send({ email: u.email, password: 'p@ssw0rd' });
    const res = await agent.post(`/user/booking/${booking._id}/rate`).send({ rating: 5 });
    expect(res.status).toBe(400);
  });
});
