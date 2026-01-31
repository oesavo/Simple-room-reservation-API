// reservations_router.js
// Router for room reservation endpoints
// Mounted by app.js at `/api/v1`

const express = require('express');
const router = express.Router();

//Functions for getting, adding and removing room reservations
const {
  getRoomById,
  addReservationToRoom,
  removeReservationFromRoom,
  getNextReservationId
} = require('../in-memory_database/room_reservations_storage');

//Helper functions for parsing ISO time and validating if times follow rules
const {
  parseIsoToMs,
  normalizeToMinute,
  isValidInterval,
  isInPast,
  intervalsOverlap
} = require('../utils/time_helpers');

// Middleware: validate room exists and attach room to req.room
function loadRoom(req, res, next) {
  const roomId = Number(req.params.roomId);
  if (!Number.isFinite(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const room = getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  req.room = room;
  next();
}

// List reservations for a room
// GET /rooms/:roomId/reservations
router.get('/rooms/:roomId/reservations', loadRoom, (req, res) => {
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
// POST /rooms/:roomId/reservations
// Body: { "start": "2026-01-24T15:00:00Z", "end": "2026-01-24T16:00:00Z" }
router.post('/rooms/:roomId/reservations', loadRoom, (req, res) => {
  const { start, end } = req.body || {};

  if (!start || !end) {
    return res.status(400).json({ error: 'Request body must include "start" and "end" RFC3339 strings' });
  }

  const rawStartMs = parseIsoToMs(start);
  const rawEndMs = parseIsoToMs(end);

  if (!isValidInterval(rawStartMs, rawEndMs)) {
    return res.status(400).json({ error: 'Invalid times: ensure "start" and "end" are valid RFC3339 datetimes and end must be after start' });
  }

  // Normalize to minute precision (truncate seconds + ms)
  const startMs = normalizeToMinute(rawStartMs);
  const endMs = normalizeToMinute(rawEndMs);

  if (!isValidInterval(startMs, endMs)) {
    return res.status(400).json({ error: 'Invalid interval after normalization: end must be after start (at minute precision)' });
  }

  if (isInPast(startMs)) {
    return res.status(400).json({ error: 'Reservation start time in UTC is in the past' });
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
    id: getNextReservationId(),
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    createdAt: new Date().toISOString()
  };

  addReservationToRoom(req.room, reservation);

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
// DELETE /rooms/:roomId/reservations/:reservationId
router.delete('/rooms/:roomId/reservations/:reservationId', loadRoom, (req, res) => {
  const reservationId = Number(req.params.reservationId);
  if (!Number.isFinite(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation id' });
  }

  const deleted = removeReservationFromRoom(req.room, reservationId);
  if (!deleted) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

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

module.exports = router;