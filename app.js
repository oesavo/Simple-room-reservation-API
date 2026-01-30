// app.js
// Express application, routes, in-memory data and helpers for Room Reservations API v1
// - exported: app, resetData

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('common'));

// In-memory data
const rooms = [];
let nextReservationId = 1;

function initRooms() {
  rooms.length = 0;
  for (let i = 0; i < 10; i++) {
    rooms.push({
      id: i + 1,
      name: `Room ${i + 1}`,
      reservations: [] // { id, startMs, endMs, startIso, endIso, createdAt }
    });
  }
  nextReservationId = 1;
}

// Initialize once
initRooms();

// Helpers

// Parse ISO/RFC3339 string -> ms since epoch, or NaN if invalid
function parseIsoToMs(isoString) {
  if (typeof isoString !== 'string') return NaN;
  const ms = Date.parse(isoString);
  return Number.isFinite(ms) ? ms : NaN;
}

// Normalize milliseconds to minute precision by truncating seconds+ms
function normalizeToMinute(ms) {
  return Math.floor(ms / 60000) * 60000;
}

// Check interval validity (numbers, end > start)
function isValidInterval(startMs, endMs) {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

// Check if start is in the past (compared at minute precision)
function isInPast(startMs) {
  const nowRounded = normalizeToMinute(Date.now());
  return startMs < nowRounded;
}

// Overlap check for half-open intervals [start, end)
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Middleware: validate room exists and attach room to req.room
function loadRoom(req, res, next) {
  const roomId = Number(req.params.roomId);
  if (!Number.isFinite(roomId) || roomId < 1 || roomId > rooms.length) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const room = rooms.find(r => r.id === roomId);
  req.room = room;
  next();
}

// API root / version root
app.get('/', (req, res) => {
  res.json({ service: 'room-reservations', version: 'v1', api_base: '/api/v1' });
});

// List reservations for a room
app.get('/api/v1/rooms/:roomId/reservations', loadRoom, (req, res) => {
  const list = req.room.reservations
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map(r => ({
      id: r.id,
      start: r.startIso,
      end: r.endIso,
      createdAt: r.createdAt
    }));
  res.json({ roomId: req.room.id, reservations: list });
});

// Create a reservation
// Body: { "start": "2026-01-24T15:00:00Z", "end": "2026-01-24T16:00:00Z" }
app.post('/api/v1/rooms/:roomId/reservations', loadRoom, (req, res) => {
  const { start, end } = req.body || {};

  if (!start || !end) {
    return res.status(400).json({ error: 'Request body must include "start" and "end" RFC3339 strings' });
  }

  const rawStartMs = parseIsoToMs(start);
  const rawEndMs = parseIsoToMs(end);

  if (!isValidInterval(rawStartMs, rawEndMs)) {
    return res.status(400).json({ error: 'Invalid times: ensure "start" and "end" are valid RFC3339 datetimes and end > start' });
  }

  // Normalize to minute precision (truncate seconds + ms)
  const startMs = normalizeToMinute(rawStartMs);
  const endMs = normalizeToMinute(rawEndMs);

  if (!isValidInterval(startMs, endMs)) {
    // This can happen if both times fall in same minute or normalization made them equal/invalid
    return res.status(400).json({ error: 'Invalid interval after normalization: end must be after start (at minute precision)' });
  }

  if (isInPast(startMs)) {
    return res.status(400).json({ error: 'Reservation start time is in the past' });
  }

  // Overlap check against existing reservations for this room
  const conflict = req.room.reservations.find(r => intervalsOverlap(startMs, endMs, r.startMs, r.endMs));
  if (conflict) {
    return res.status(409).json({
      error: 'Time conflict with existing reservation',
      conflict: {
        id: conflict.id,
        start: conflict.startIso,
        end: conflict.endIso
      }
    });
  }

  const reservation = {
    id: nextReservationId++,
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    createdAt: new Date().toISOString()
  };

  req.room.reservations.push(reservation);

  res.status(201).json({
    message: 'Reservation created',
    roomId: req.room.id,
    reservation: {
      id: reservation.id,
      start: reservation.startIso,
      end: reservation.endIso,
      createdAt: reservation.createdAt
    }
  });
});

// Delete a reservation by id
app.delete('/api/v1/rooms/:roomId/reservations/:reservationId', loadRoom, (req, res) => {
  const reservationId = Number(req.params.reservationId);
  if (!Number.isFinite(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation id' });
  }

  const idx = req.room.reservations.findIndex(r => r.id === reservationId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  const [deleted] = req.room.reservations.splice(idx, 1);
  res.json({
    message: 'Reservation deleted',
    roomId: req.room.id,
    reservation: {
      id: deleted.id,
      start: deleted.startIso,
      end: deleted.endIso,
      createdAt: deleted.createdAt
    }
  });
});

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Internal server error' });
});

// Helper to reset data for tests or development
function resetData() {
  initRooms();
}

module.exports = { app, resetData };