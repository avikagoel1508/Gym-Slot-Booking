const express = require('express');
const Session = require('../models/Session.js');
const Booking = require('../models/Booking.js');
const Waitlist = require('../models/Waitlist.js');
const { asyncHandler } = require('../utils/asyncHandler.js');
const { errors } = require('../utils/errors.js');
const { requireAuth, requireAdmin } = require('../middleware/auth.js');
const { serializeSession, serializeBooking } = require('../utils/serialize.js');
const { emitSeatUpdate } = require('../realtime.js');
const {
  bookSeat,
  cancelBooking,
  seatSnapshot,
} = require('../services/booking.service.js');

const router = express.Router();
router.use(requireAuth);

// Push the newest seat numbers to every browser watching this session.
async function broadcast(sessionId) {
  const snap = await seatSnapshot(sessionId);
  if (snap) emitSeatUpdate(snap);
}

// POST /api/sessions/:id/book  — book a seat for the logged-in member.
router.post(
  '/sessions/:id/book',
  asyncHandler(async (req, res) => {
    const booking = await bookSeat(req.params.id, req.user._id);
    await broadcast(req.params.id);
    res.status(201).json({ booking: serializeBooking(booking) });
  })
);

// POST /api/sessions/:id/waitlist — join the waitlist when the session is full.
router.post(
  '/sessions/:id/waitlist',
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) throw errors.notFound('Session not found.', 'SESSION_NOT_FOUND');

    const hasSeat = session.confirmedCount < session.capacity;
    if (hasSeat) {
      throw errors.conflict('There are still seats free — book directly instead.', 'SEATS_AVAILABLE');
    }

    const existingBooking = await Booking.findOne({
      session: session._id,
      member: req.user._id,
      status: 'booked',
    });
    if (existingBooking) throw errors.conflict('You already have a booking for this session.', 'ALREADY_BOOKED');

    const already = await Waitlist.findOne({ session: session._id, member: req.user._id });
    if (already) throw errors.conflict('You are already on this waitlist.', 'ALREADY_WAITING');

    const entry = await Waitlist.create({ session: session._id, member: req.user._id });
    await broadcast(session._id);
    res.status(201).json({ waitlist: { id: entry._id, sessionId: session._id } });
  })
);

// DELETE /api/sessions/:id/waitlist — leave the waitlist.
router.delete(
  '/sessions/:id/waitlist',
  asyncHandler(async (req, res) => {
    const entry = await Waitlist.findOneAndDelete({
      session: req.params.id,
      member: req.user._id,
    });
    if (!entry) throw errors.notFound('You are not on this waitlist.', 'NOT_WAITING');
    await broadcast(req.params.id);
    res.json({ ok: true });
  })
);

// DELETE /api/bookings/:id — cancel your own booking.
router.delete(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw errors.notFound('Booking not found.', 'BOOKING_NOT_FOUND');

    // Ownership check: a member can only touch their own booking.
    if (String(booking.member) !== String(req.user._id)) {
      throw errors.forbidden('You can only cancel your own bookings.');
    }

    const session = await Session.findById(booking.session);
    if (!session) throw errors.notFound('Session not found.', 'SESSION_NOT_FOUND');

    const promoted = await cancelBooking(booking, session);
    await broadcast(session._id);

    res.json({
      ok: true,
      promotedBooking: promoted ? serializeBooking(promoted) : null,
    });
  })
);

// GET /api/bookings/me — the member's own bookings (never anyone else's).
router.get(
  '/bookings/me',
  asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ member: req.user._id, status: { $ne: 'cancelled' } })
      .populate('session')
      .sort({ createdAt: -1 });

    res.json({
      bookings: bookings.map((b) =>
        serializeBooking(b, {
          session: b.session ? serializeSession(b.session) : null,
        })
      ),
    });
  })
);

// GET /api/sessions/:id/bookings — admin view of everyone in a session.
router.get(
  '/sessions/:id/bookings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) throw errors.notFound('Session not found.', 'SESSION_NOT_FOUND');

    const [bookings, waitEntries] = await Promise.all([
      Booking.find({ session: session._id }).populate('member', 'name email').sort({ createdAt: 1 }),
      Waitlist.find({ session: session._id }).populate('member', 'name email').sort({ createdAt: 1 }),
    ]);

    res.json({
      session: serializeSession(session),
      bookings: bookings.map((b) =>
        serializeBooking(b, {
          member: b.member ? { id: b.member._id, name: b.member.name, email: b.member.email } : null,
        })
      ),
      waitlist: waitEntries.map((w) => ({
        id: w._id,
        member: w.member ? { id: w.member._id, name: w.member.name, email: w.member.email } : null,
        joinedAt: w.createdAt,
      })),
    });
  })
);

module.exports = router;
