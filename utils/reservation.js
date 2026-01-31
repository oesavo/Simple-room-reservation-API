// Factory for reservation objects used by the reservation routes.
// Returns an object with internal ms values and ISO fields for responses.
// A reservation has an id, start and end time in ms, start and end time in ISO format and ISO time when it was created

function createReservation(id, startMs, endMs) {
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  const createdAt = new Date().toISOString();

  return {
    id,
    startMs,
    endMs,
    startIso,
    endIso,
    createdAt
  };
}

module.exports = { createReservation };