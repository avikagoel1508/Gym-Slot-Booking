const Session = require('../models/Session.js');
const Booking = require('../models/Booking.js');
const Waitlist = require('../models/Waitlist.js');
const { genCode } = require('../utils/codes.js');
const { errors } = require('../utils/errors.js');
const { hasStarted } = require('../utils/time.js');
const { serializeSession } = require('../utils/serialize.js');

// Reserve one seat, but only if the session still has room.
//
// This is the piece that makes overbooking impossible: MongoDB applies a
// single-document update atomically, and the filter "confirmedCount < capacity"
// means the update only happens when there is a free seat. Two people racing
// for the last seat both run this; exactly one gets a result back, the other
// gets null and is told the session is full.
async function reserveSeat(sessionId) {
  return Session.findOneAndUpdate(
    { _id: sessionId, $expr: { $lt: ['$confirmedCount', '$capacity'] } },
    { $inc: { confirmedCount: 1 } },
    { new: true }
  );
}

// Give a seat back (used when a booking is cancelled or fails to save).
async function releaseSeat(sessionId) {
  await Session.findOneAndUpdate(
    { _id: sessionId, confirmedCount: { $gt: 0 } },
    { $inc: { confirmedCount: -1 } }
  );
}

// Create a booking with a fresh unique check-in code.
async function createBookingWithCode(sessionId, memberId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Booking.create({ session: sessionId, member: memberId, code: genCode() });
    } catch (err) {
      // 11000 = duplicate key. Either the code collided (retry) or the member
      // already holds a booking (someone beat us to it).
      if (err && err.code === 11000) {
        if (String(err.message).includes('code')) continue;
        throw errors.conflict('You already have a booking for this session.', 'ALREADY_BOOKED');
      }
      throw err;
    }
  }
  throw errors.conflict('Could not allocate a check-in code.', 'CODE_COLLISION');
}

// The first person on the waitlist is promoted when a seat frees up.
// Nobody is promoted into a session that has already started.
async function promoteFirstFromWaitlist(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session || hasStarted(session)) return null;

  const entry = await Waitlist.findOne({ session: sessionId }).sort({ createdAt: 1, _id: 1 });
  if (!entry) return null;

  const reserved = await reserveSeat(sessionId);
  if (!reserved) return null; // seat vanished in a race, leave them waiting

  try {
    const booking = await createBookingWithCode(sessionId, entry.member);
    await Waitlist.deleteOne({ _id: entry._id });
    return booking;
  } catch (err) {
    await releaseSeat(sessionId);
    if (err && err.code === 11000) await Waitlist.deleteOne({ _id: entry._id });
    return null;
  }
}

// Book a session for a member. Throws AppErrors the route can send straight
// back to the client.
async function bookSeat(sessionId, userId) {
  const session = await Session.findById(sessionId);
  if (!session) throw errors.notFound('Session not found.', 'SESSION_NOT_FOUND');
  if (hasStarted(session)) {
    throw errors.conflict('This session has already started.', 'SESSION_STARTED');
  }

  const already = await Booking.findOne({ session: sessionId, member: userId, status: 'booked' });
  if (already) throw errors.conflict('You already have a booking for this session.', 'ALREADY_BOOKED');

  const reserved = await reserveSeat(sessionId);
  if (!reserved) {
    throw errors.conflict('This session is full. Join the waitlist instead.', 'SESSION_FULL');
  }

  try {
    const booking = await createBookingWithCode(sessionId, userId);
    // Booking directly also clears any waitlist entry for the same session.
    await Waitlist.deleteOne({ session: sessionId, member: userId });
    return booking;
  } catch (err) {
    await releaseSeat(sessionId);
    throw err;
  }
}

// Cancel a booking and hand the freed seat to the first person waiting.
async function cancelBooking(booking, session) {
  if (booking.status !== 'booked') {
    throw errors.conflict('This booking is no longer active.', 'BOOKING_NOT_ACTIVE');
  }
  if (hasStarted(session)) {
    throw errors.conflict('You cannot cancel once the session has started.', 'SESSION_STARTED');
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();
  await releaseSeat(session._id);
  const promoted = await promoteFirstFromWaitlist(session._id);
  return promoted;
}

// Latest seat numbers for a session, used to drive the live UI.
async function seatSnapshot(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) return null;
  const waitlistCount = await Waitlist.countDocuments({ session: sessionId });
  return serializeSession(session, { waitlistCount });
}

module.exports = {
  reserveSeat,
  releaseSeat,
  createBookingWithCode,
  promoteFirstFromWaitlist,
  bookSeat,
  cancelBooking,
  seatSnapshot,
};
