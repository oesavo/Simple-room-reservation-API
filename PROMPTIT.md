You said:
Hey how should I start making a simple API with JavaScript?


Copilot said:
Nice — building a simple API with JavaScript is a great way to learn backend basics. Below is a short, practical guide that walks you through a minimal REST API using Node.js + Express, how to run it, test it, and next steps you can take.

What I'll do for you now

Show a minimal project (package.json + index.js) that runs a small in-memory API.
Give commands to install, run, and test with curl.
Suggest simple improvements and deployment options.
Files to create

package.json
{
  "name": "simple-api",
  "version": "1.0.0",
  "description": "A minimal REST API with Express",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}

index.js
// A minimal Express API with an in-memory store
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // parse JSON bodies

// Simple in-memory "database"
let items = [
  { id: 1, name: 'First item' },
  { id: 2, name: 'Second item' }
];
let nextId = 3;

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello — simple API is running' });
});

app.get('/items', (req, res) => {
  res.json(items);
});

app.get('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/items', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid payload: name required' });
  }
  const newItem = { id: nextId++, name };
  items.push(newItem);
  res.status(201).json(newItem);
});

app.put('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body;
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid payload: name required' });
  }
  items[idx].name = name;
  res.json(items[idx]);
});

app.delete('/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const deleted = items.splice(idx, 1)[0];
  res.json(deleted);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

How to set this up locally

Install Node.js (v16+ recommended).
Create a project folder, save the two files above.
Run:
npm install
npm run dev (uses nodemon for auto-restart during development)
or npm start
Test the API (examples using curl)

Check root:
curl http://localhost:3000/
List items:
curl http://localhost:3000/items
Get one item:
curl http://localhost:3000/items/1
Create an item:
curl -X POST http://localhost:3000/items -H "Content-Type: application/json" -d '{"name":"My new item"}'
Update:
curl -X PUT http://localhost:3000/items/1 -H "Content-Type: application/json" -d '{"name":"Updated name"}'
Delete:
curl -X DELETE http://localhost:3000/items/1
What to improve next (recommended incremental steps)

Validation: use a library like Joi or zod for stronger payload validation.
Persistence: replace in-memory store with a database:
SQLite (good for small projects), PostgreSQL, or MongoDB.
Project structure:
Move routes into separate modules (routes/, controllers/, services/).
Environment & secrets:
Use .env for PORT and DB URL (dotenv already included).
Logging & monitoring:
Add a logger (pino or winston).
Testing:
Add unit/integration tests (Jest + supertest).
Security:
Use helmet, rate-limiting, and validate user input to avoid injection.
TypeScript:
Add TypeScript for safer code as the project grows.
Deployment:
Deploy to Railway, Vercel (serverless functions) or Heroku; set environment variables in the hosting provider.
If you want, I can:

Create a version that uses TypeScript.
Show how to persist items in SQLite or MongoDB.
Split the app into route/controller files and show the folder layout.
Provide Dockerfile and production tips.
Which of those would you like next?


You said:
The API is for reserving rooms for a time. I need the in-memory database to be 10 rooms where I can add reserved times instead of items. How should I format the times, if I want the reservations to have a start time and an end time, and I want the reservations to be easily comparable, so I can prevent them from overlapping, reservation end time being before the start time or reservations being made to the past?


Copilot said:
Good choice — keep times in a standard text format for input (easy for humans/clients) and convert to a canonical numeric form for storage/comparison. Below I cover the format, the validation rules, the overlap logic (with explanation), and a ready-to-use Express example that creates 10 rooms in-memory and lets you add reservations with proper checks.

Recommended time format

Accept ISO 8601 / RFC 3339 strings (e.g. "2026-01-24T15:00:00Z" or "2026-01-24T10:00:00-05:00"). These include timezone information, are unambiguous, and work well with JavaScript Date parsing and most clients.
Internally convert and store times as integer milliseconds since the UNIX epoch (Date.now() style). Numbers are fastest and simplest to compare.
Treat time intervals as half-open [start, end) (start inclusive, end exclusive). This allows back-to-back reservations where end of one equals start of another without counting as overlap.
Validation rules you should enforce

Parse both inputs to milliseconds and ensure they are valid dates.
end > start (strictly greater). If you want zero-length reservations to be allowed, use >=, but typically you want end > start.
start >= now (prevent creating reservations in the past). Use Date.now() and allow a small skew if needed.
Optionally enforce business rules: minimum duration, max duration, minimum lead time before start, working-hours limits, etc.
Overlap check for the target room (see algorithm below).
Overlap detection (core rule)

For two intervals A = [aStart, aEnd) and B = [bStart, bEnd), they overlap iff: aStart < bEnd && bStart < aEnd
For a new reservation N = [s, e) and an existing R = [rs, re), check: if (s < re && rs < e) then conflict (overlap)
This condition allows end == start (adjacent) without counting as overlap because s < re is false when s === re.
Edge cases

Use strict numeric comparisons (millis).
Rounding/truncation: you may want to normalize inputs to minute precision (e.g., round seconds to 0) to avoid tiny-second mismatches.
Timezones: always convert to UTC milliseconds for comparison.
Concurrent writes (race conditions): in-memory only for dev; in production, use DB transactional checks or row-level locking.
Example: Express code (in-memory 10 rooms)

JavaScript
// name=rooms-api.js
// Minimal Express example: 10 rooms in memory, create reservations with validation & overlap checks.

const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Create 10 rooms with empty reservations
// room ids: 1..10
const rooms = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Room ${i + 1}`,
  // reservations: array of { id, startMs, endMs, startIso, endIso, createdAt }
  reservations: []
}));

let nextReservationId = 1;

// Helpers
function parseIsoToMs(iso) {
  // Accepts ISO 8601 string with timezone; returns millis or NaN
  const t = Date.parse(iso);
  return isNaN(t) ? NaN : t;
}

function isInPast(startMs, nowMs = Date.now()) {
  // start must be >= now (allow starting exactly now). Adjust if you want a lead time.
  return startMs < nowMs;
}

function isValidInterval(startMs, endMs) {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

function overlaps(newStartMs, newEndMs, existing) {
  // existing: { startMs, endMs }
  return newStartMs < existing.endMs && existing.startMs < newEndMs;
}

// POST /rooms/:roomId/reservations
// Body: { start: "2026-01-24T15:00:00Z", end: "2026-01-24T16:00:00Z" }
app.post('/rooms/:roomId/reservations', (req, res) => {
  const roomId = Number(req.params.roomId);
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { start, end } = req.body;
  if (!start || !end) return res.status(400).json({ error: 'start and end required in ISO 8601 format' });

  const startMs = parseIsoToMs(start);
  const endMs = parseIsoToMs(end);
  if (!isValidInterval(startMs, endMs)) {
    return res.status(400).json({ error: 'Invalid interval: ensure start and end are valid ISO times and end > start' });
  }

  if (isInPast(startMs)) {
    return res.status(400).json({ error: 'Reservation start time is in the past' });
  }

  // Optional: normalize times to minute precision
  // const normalize = ms => Math.floor(ms / 60000) * 60000;
  // const s = normalize(startMs), e = normalize(endMs);

  // Overlap check
  const conflict = room.reservations.find(r => overlaps(startMs, endMs, r));
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

  room.reservations.push(reservation);

  res.status(201).json({ reservation, roomId: room.id });
});

// Simple endpoint to list reservations for a room
app.get('/rooms/:roomId/reservations', (req, res) => {
  const roomId = Number(req.params.roomId);
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  // Return sorted by start
  const list = room.reservations.slice().sort((a, b) => a.startMs - b.startMs);
  res.json(list);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

Example requests (curl)

Create reservation: curl -X POST http://localhost:3000/rooms/1/reservations -H "Content-Type: application/json" -d '{"start":"2026-01-25T14:00:00Z","end":"2026-01-25T15:00:00Z"}'
List room reservations: curl http://localhost:3000/rooms/1/reservations
Production considerations and recommendations

Use a robust date library (Luxon, date-fns, or Day.js) for parsing/formatting and timezone handling if clients send local times frequently.
Persist reservations in a database (Postgres, etc.) and enforce overlap constraints at the DB layer (transactions + SELECT FOR UPDATE or exclusion constraints in Postgres using tstzrange and EXCLUDE).
Add unit/integration tests for the overlap logic and boundary cases.
Consider business rules: allow editing/canceling, hold time, recurring reservations, time zone display to users, and daylight saving time edge cases.
Consider returning unified errors with codes so client UIs can react (e.g., conflict -> 409).
If you want, I can:

Convert the example into a full file to drop into the earlier project.
Add minute-precision normalization or minimum duration rules.
Show how to implement overlap protection using PostgreSQL exclusion constraints for a production-ready approach.
Which of those would you like next?


You said:
I need you to write the simple API for room reservations in JavaScript using Node.js. The project can be built with just the basic dependencies needed to make this simple API work. The API should be versioned to prevent new features breaking the old API in the future and the current version is V1. The features of the API is adding a reservation for a room using POST, deleting a reservation using DELETE and listing all of the reservations for a selected room using GET. 

The system will have 10 reservable rooms as a start. These rooms can be stored in an in-memory database for the time being. Each room has its own reservations and these reservations should have a start time and an end time that are accepted in RFC 3339 format and stored internally as integer milliseconds so they are easy to compare. The seconds should be rounded to zero to avoid millisecond mismatches. We can assume the API users aren't coming from different time zones. 

The start and end times for a reservation need to be validated that they're in the correct format and that they follow the reservation rules. The logic for reservations is that the reservations for a room can't overlap, but the next reservation can start on the minute that the last one ends, the reservations can't be placed in the past and the reservation end time can't be before the start time. There are no business rules such as minimum or max duration, but these might be implemented in the future. If the posted reservation doesn't meet the requirements, an appropriate error message should be returned.

Can you give me the package.json and index,js files for this project and then give me the next steps to install and develop this project?


Copilot said:
I've created a minimal Node.js + Express API that implements your requirements:

10 in-memory rooms (ids 1–10), each with its own reservations
Versioned API: /api/v1/...
Endpoints:
POST /api/v1/rooms/:roomId/reservations — create a reservation
GET /api/v1/rooms/:roomId/reservations — list reservations for a room
DELETE /api/v1/rooms/:roomId/reservations/:reservationId — delete a reservation
Times accepted in RFC 3339 (ISO 8601) strings and stored internally as integer milliseconds
Seconds and milliseconds are truncated to minute precision to avoid tiny mismatches
Validation rules enforced:
start and end must parse to valid dates
end > start
start must not be in the past (compared at minute precision)
reservations for the same room must not overlap; adjacency (end === next start) is allowed
Appropriate HTTP status codes and helpful JSON error messages
Files below: package.json and index.js. Drop them into a project folder.

package.json
v2
{
  "name": "room-reservations-api",
  "version": "1.0.0",
  "description": "Simple in-memory room reservations API (v1)",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "keywords": ["express", "api", "reservations", "rooms"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}

index.js
v2
// Simple Room Reservations API (v1)
// - 10 in-memory rooms (1..10)
// - Endpoints:
//   POST   /api/v1/rooms/:roomId/reservations
//   GET    /api/v1/rooms/:roomId/reservations
//   DELETE /api/v1/rooms/:roomId/reservations/:reservationId
//
// Times accepted as RFC 3339 (ISO 8601). Internally stored as integer milliseconds.
// Seconds/milliseconds truncated to minute precision.

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize 10 rooms (ids 1..10)
const rooms = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Room ${i + 1}`,
  reservations: [] // reservations: { id, startMs, endMs, startIso, endIso, createdAt }
}));

let nextReservationId = 1;

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

app.listen(PORT, () => {
  console.log(`Room reservations API v1 listening on http://localhost:${PORT}`);
});

Next steps — install, run, and develop

Save the two files above in a new folder (package.json and index.js).
Install dependencies:
npm install
Run in development mode (auto-restart on changes):
npm run dev Or run normally:
npm start
Example curl requests (replace times as needed)
Create reservation (room 1): curl -X POST http://localhost:3000/api/v1/rooms/1/reservations
-H "Content-Type: application/json"
-d '{"start":"2026-01-25T14:00:00Z","end":"2026-01-25T15:00:00Z"}'
List reservations for room 1: curl http://localhost:3000/api/v1/rooms/1/reservations
Delete a reservation (id 2): curl -X DELETE http://localhost:3000/api/v1/rooms/1/reservations/2
Ideas for incremental improvements

Add unit and integration tests (Jest + supertest) for edge cases (adjacent reservations, boundary minute rounding).
Add request body schema validation (e.g., zod or Joi) for clearer validation messages.
Add logging (morgan or pino).
Replace in-memory store with a database. For production with Postgres you can use an exclusion constraint (tstzrange with EXCLUDE) to prevent overlaps atomically.
Add authentication/authorization if reservations should be user-scoped.
Add endpoints to update/cancel reservations with appropriate concurrency/transaction checks.
Consider returning a machine-friendly error code in responses (e.g., { code: 'CONFLICT_OVERLAP', ... }) to make client handling simpler.
If you want, I can:

Add a README with exact curl examples and sample responses.
Add tests for the overlap logic and minute-normalization behavior.
Convert the project to TypeScript. Which of those would you like next?


You said:
Next add logging to the room reservation API using morgan. You can use the common log output format for this. 

After that I'd like you to write tests for the room reservation API using Jest and supertest. These tests should test that the validation rules for creating a reservation work as intended.


Copilot said:
package.json
v3
{
  "name": "room-reservations-api",
  "version": "1.1.0",
  "description": "Simple in-memory room reservations API (v1) with logging and tests",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "keywords": ["express", "api", "reservations", "rooms"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "jest": "^29.6.1",
    "nodemon": "^2.0.22",
    "supertest": "^6.3.3"
  },
  "jest": {
    "testEnvironment": "node"
  }
}

index.js
v3
// Simple Room Reservations API (v1) with morgan logging
// - 10 in-memory rooms (1..10)
// - Endpoints:
//   POST   /api/v1/rooms/:roomId/reservations
//   GET    /api/v1/rooms/:roomId/reservations
//   DELETE /api/v1/rooms/:roomId/reservations/:reservationId
//
// Times accepted as RFC 3339 (ISO 8601). Internally stored as integer milliseconds.
// Seconds/milliseconds truncated to minute precision.
// Morgan is used with the "common" format for request logging.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('common'));

const PORT = process.env.PORT || 3000;

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

// Start server when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Room reservations API v1 listening on http://localhost:${PORT}`);
  });
}

tests/reservations.test.js
const request = require('supertest');
const { app, resetData } = require('../index');

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

Next steps — install, run, develop and test

Save the three files above:

package.json
index.js
tests/reservations.test.js (create a tests/ folder)
Install dependencies:

npm install
Run the server (dev mode with auto-reload):

npm run dev or
npm start
The server listens on http://localhost:3000 by default.

Run tests:

npm test
What I changed and why

Added morgan (common format) for request logging, wired with app.use(morgan('common')).
Made index.js export the Express app and a resetData helper so tests can reset the in-memory store between test cases.
Added Jest + Supertest devDependencies and a suite of tests covering the POST validation rules you asked for:
missing fields
invalid format
end <= start
start in the past
normalization producing invalid intervals
overlap detection
adjacency allowed
If you want next:

I can add more tests (DELETE, GET, list ordering).
Add a README with example curl commands and sample responses.
Convert to a small app layout (app.js/server.js) and add linting (ESLint).
Add schema validation (zod/Joi) to improve error messages consistency.
Which of those would you like me to do next?


You said:
I want to change index.js so that only server related features remain in it and app features are moved to a new file called app.js.


Copilot said: 
Here are the two updated files. app.js
Here are the two updated files. app.js contains the Express app, routes, middleware, data and helpers. index.js now only contains server/startup logic and re-exports the app + resetData so existing tests keep working.

app.js
v1
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

index.js
v4
// index.js
// Server startup (only server related features)
// - imports app from ./app
// - starts listening only when run directly
// - re-exports app and resetData for tests

const { app, resetData } = require('./app');

const PORT = process.env.PORT || 3000;

// Start server when run directly: `node index.js`
// When required (e.g. tests), this will NOT start the server.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Room reservations API v1 listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, resetData };s

Notes and next steps

Replace your current index.js contents with the new index.js above and add the new app.js file.
No changes are required to tests that import from index.js; index.js still exports { app, resetData }.
Start server for development with npm start or npm run dev as before. Tests will require the module without starting the server.
If you want, I can:
Move tests to import directly from app.js (optional).
Add a small server.js instead of index.js if you prefer different naming.
Provide a README showing the new layout and how to run tests.


You said: 
Next I want to change app.js so
Next I want to change app.js so that the REST functions like post, get and delete reservations are moved to their own file, which app.js then uses. How should I go about this?


Copilot said: 
Good plan — splitting routes into their
Good plan — splitting routes into their own file keeps app.js focused on wiring and middleware and makes the code easier to test and evolve.

What I'll give you

A small store module (store.js) that holds the in-memory rooms and reset function.
A routes file (routes/reservations.js) that contains the GET / POST / DELETE handlers.
An updated app.js that wires middleware and mounts the router.
(index.js remains the server entry you already have — I include it for completeness.)
Drop these files into your project root (create a routes/ folder for the routes file). The behavior is unchanged; only the responsibilities are separated.

Files

store.js
// store.js
// In-memory data store and helpers for tests/dev reset

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

// initialize on load
initRooms();

function resetData() {
  initRooms();
}

function getRoomById(roomId) {
  return rooms.find(r => r.id === Number(roomId));
}

function addReservationToRoom(room, reservation) {
  room.reservations.push(reservation);
}

function removeReservationFromRoom(room, reservationId) {
  const idx = room.reservations.findIndex(r => r.id === Number(reservationId));
  if (idx === -1) return null;
  return room.reservations.splice(idx, 1)[0];
}

function getNextReservationId() {
  return nextReservationId++;
}

module.exports = {
  rooms,
  resetData,
  getRoomById,
  addReservationToRoom,
  removeReservationFromRoom,
  getNextReservationId
};

routes/reservations.js
// routes/reservations.js
// Router for room reservation endpoints
// Mounted by app.js at `/api/v1`

const express = require('express');
const router = express.Router();

const {
  getRoomById,
  addReservationToRoom,
  removeReservationFromRoom,
  getNextReservationId
} = require('../store');

// Helpers (kept local to routing logic)

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
    return res.status(400).json({ error: 'Invalid times: ensure "start" and "end" are valid RFC3339 datetimes and end > start' });
  }

  // Normalize to minute precision (truncate seconds + ms)
  const startMs = normalizeToMinute(rawStartMs);
  const endMs = normalizeToMinute(rawEndMs);

  if (!isValidInterval(startMs, endMs)) {
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

app.js
v2
// app.js
// Express application wiring: middleware, mounting routes, exports app + resetData

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const reservationsRouter = require('./routes/reservations');
const { resetData } = require('./store');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('common'));

// Root info
app.get('/', (req, res) => {
  res.json({ service: 'room-reservations', version: 'v1', api_base: '/api/v1' });
});

// Mount reservation routes under /api/v1
app.use('/api/v1', reservationsRouter);

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = { app, resetData };

index.js
v5
// index.js
// Server startup (only server related features)
// - imports app from ./app
// - starts listening only when run directly
// - re-exports app and resetData for tests

const { app, resetData } = require('./app');

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Room reservations API v1 listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, resetData };

Instructions / Steps to implement

Create a new file store.js in project root and paste the first block.
Create a new folder routes/ and add routes/reservations.js with the router code.
Replace your current app.js with the provided app.js code (or update it to require the new router).
Keep index.js as shown (or replace your current version with the provided one).
Run your tests (they should still work since index.js exports resetData and app as before):
npm test
Start the server in development:
npm run dev
or npm start
Why this structure

store.js centralizes in-memory data and reset logic so tests can reset state reliably.
routes/reservations.js isolates request handlers and routing concerns.
app.js focuses on middleware and mounting routers.
index.js is strictly the process entry point (starts the server only when executed directly), so tests can import app without starting the HTTP server.
Next options you might want

Move the route helper functions (parsing/validation) into a shared utils file if multiple routers need them.
Add unit tests for the route helpers separately.
Add more routers (e.g., /rooms endpoints) and mount them under /api/v1.
Add TypeScript and split types for the store and route contracts.
Want me to:

Update the test file paths or show a small test demonstrating the new layout?
Move the time/validation helpers to a shared module? Which would you like next?
