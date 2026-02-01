//Helper functions for parcing and checking ISO time validity used in reservations_router.js
//Separated to their own module for reusability

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
// True if interval is valid
function isValidInterval(startMs, endMs) {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

// Check if start is in the past (compared at minute precision)
// True if starts in the past
function isInPast(startMs) {
  const nowRounded = normalizeToMinute(Date.now());
  return startMs < nowRounded;
}

// Overlap check for half-open intervals [start, end)
// True if there is overlap
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Check if reservation is over 12 hours long to prevent reservations that last for days
// True if reservation is over 12 hours long
function isTooLong(startMs, endMs) {
  return ((endMs - startMs) > 12 * 3600000 )
}

module.exports = {
    parseIsoToMs,
    normalizeToMinute,
    isValidInterval,
    isInPast,
    intervalsOverlap,
    isTooLong
};