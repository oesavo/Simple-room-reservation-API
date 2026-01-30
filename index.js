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

module.exports = { app, resetData };