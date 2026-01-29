const request = require('supertest');
const { app, resetData } = require('./index');

// Helper to normalize to minute and produce ISO strings with second offsets
function normalizeToMinute(ms) {
  return Math.floor(ms / 60000) * 60000;
}

beforeEach(() => {
  resetData();
});

describe('Room reservations - POST /api/v1/rooms/:roomId/reservations (validation)', () => {
  test('creates a valid reservation (201)', async () => {
    const start = new Date(Date.now() + 5 * 60000).toISOString(); // +5 minutes
    const end = new Date(Date.now() + 65 * 60000).toISOString(); // +65 minutes

    const res = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start, end })
      .set('Accept', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('reservation');
    expect(res.body.reservation).toHaveProperty('id');
    expect(res.body.reservation).toHaveProperty('start');
    expect(res.body.reservation).toHaveProperty('end');
  });

  test('missing start or end -> 400', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({})
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/include "start" and "end"/);
  });

  test('invalid date format -> 400', async () => {
    const res = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start: 'not-a-date', end: new Date(Date.now() + 60000).toISOString() })
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid times/);
  });

  test('end <= start (same time) -> 400', async () => {
    const base = new Date(Date.now() + 10 * 60000); // +10 minutes
    const start = base.toISOString();
    const end = base.toISOString(); // same instant

    const res = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start, end })
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/end.*after start/);
  });

  test('start in the past -> 400', async () => {
    const start = new Date(Date.now() - 60 * 60000).toISOString(); // -60 minutes
    const end = new Date(Date.now() + 60 * 60000).toISOString(); // +60 minutes

    const res = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start, end })
      .set('Accept', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/start time is in the past/);
  });

  test('normalization to minute can make interval invalid -> 400', async () => {
    // Create start and end within same minute but different seconds so they parse valid
    const baseMinute = normalizeToMinute(Date.now() + 15 * 60000); // +15 minutes rounded to minute
    const startMs = baseMinute + 30000; // :30 seconds into the minute
    const endMs = baseMinute + 45000; // :45 seconds into the same minute
    const start = new Date(startMs).toISOString();
    const end = new Date(endMs).toISOString();

    const res = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start, end })
      .set('Accept', 'application/json');

    // After normalization both become the same minute -> invalid interval
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid interval after normalization/);
  });

  test('overlapping reservation -> 409', async () => {
    // First reservation 10:00 - 11:00
    const start1 = new Date(Date.now() + 20 * 60000).toISOString();
    const end1 = new Date(Date.now() + 80 * 60000).toISOString();

    const create1 = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start: start1, end: end1 })
      .set('Accept', 'application/json');

    expect(create1.status).toBe(201);

    // Overlapping reservation: starts inside first reservation
    const start2 = new Date(Date.parse(start1) + 10 * 60000).toISOString(); // +10 minutes after start1
    const end2 = new Date(Date.parse(start1) + 30 * 60000).toISOString(); // overlaps

    const create2 = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start: start2, end: end2 })
      .set('Accept', 'application/json');

    expect(create2.status).toBe(409);
    expect(create2.body.error).toMatch(/Time conflict/);
    expect(create2.body.conflict).toBeDefined();
    expect(create2.body.conflict).toHaveProperty('id');
  });

  test('adjacent reservation allowed (end === next start) -> 201', async () => {
    const start1 = new Date(Date.now() + 30 * 60000).toISOString();
    const end1 = new Date(Date.now() + 90 * 60000).toISOString();

    const r1 = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start: start1, end: end1 })
      .set('Accept', 'application/json');

    expect(r1.status).toBe(201);

    // Next reservation starts exactly when r1 ends (after normalization this is allowed)
    const start2 = r1.body.reservation.end;
    const end2 = new Date(Date.parse(start2) + 30 * 60000).toISOString();

    const r2 = await request(app)
      .post('/api/v1/rooms/1/reservations')
      .send({ start: start2, end: end2 })
      .set('Accept', 'application/json');

    expect(r2.status).toBe(201);
  });
});