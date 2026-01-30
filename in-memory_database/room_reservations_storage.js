// room_reservations_storage.js
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