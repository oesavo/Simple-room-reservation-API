// app.js
// Express application wiring: middleware, mounting routes, exports app + resetData

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const reservationsRouter = require('./routes/reservations_router');
const { resetData } = require('./in-memory_database/room_reservations_storage');

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