const { sessionStart, sessionEnd, hasStarted } = require('./time.js');

// Shape a session for the API, including derived fields the client needs.
function serializeSession(session, extra = {}) {
  const capacity = session.capacity;
  const confirmedCount = session.confirmedCount || 0;
  return {
    id: session._id.toString(),
    date: session.date,
    startHour: session.startHour,
    capacity,
    confirmedCount,
    seatsRemaining: Math.max(0, capacity - confirmedCount),
    startAt: sessionStart(session.date, session.startHour).toISOString(),
    endAt: sessionEnd(session.date, session.startHour).toISOString(),
    started: hasStarted(session),
    ...extra,
  };
}

// Shape a booking. The check-in code is only shared with the member who owns
// it (admins never need it, they type the code the member shows them).
function serializeBooking(booking, extra = {}) {
  return {
    id: booking._id.toString(),
    status: booking.status,
    code: booking.status === 'cancelled' ? null : booking.code,
    attendedAt: booking.attendedAt || null,
    cancelledAt: booking.cancelledAt || null,
    createdAt: booking.createdAt,
    ...extra,
  };
}

module.exports = { serializeSession, serializeBooking };
