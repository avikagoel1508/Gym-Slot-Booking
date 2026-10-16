const express = require('express');
const Booking = require('../models/Booking.js');
const { asyncHandler } = require('../utils/asyncHandler.js');
const { errors } = require('../utils/errors.js');
const { requireAuth, requireAdmin } = require('../middleware/auth.js');
const { isWithinSessionHour } = require('../utils/time.js');

const router = express.Router();
router.use(requireAuth, requireAdmin); // check-in is an admin job

// POST /api/checkin { code } — mark a member present using their short code.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string' || code.trim() === '') {
      throw errors.unprocessable('A check-in code is required.');
    }

    const clean = code.trim().toUpperCase();
    const booking = await Booking.findOne({ code: clean })
      .populate('member', 'name email')
      .populate('session');

    // Do not reveal whether a code exists vs. is just wrong.
    if (!booking) throw errors.notFound('No booking matches that code.', 'CODE_NOT_FOUND');

    if (booking.status === 'cancelled') {
      throw errors.conflict('That booking was cancelled.', 'BOOKING_CANCELLED');
    }
    if (booking.status === 'attended') {
      throw errors.conflict('That code has already been used.', 'ALREADY_CHECKED_IN');
    }
    if (!booking.session) throw errors.notFound('Session not found.', 'SESSION_NOT_FOUND');
    if (!isWithinSessionHour(booking.session)) {
      throw errors.conflict('This code only works during its session hour.', 'OUTSIDE_SESSION_HOUR');
    }

    booking.status = 'attended';
    booking.attendedAt = new Date();
    await booking.save();

    res.json({
      ok: true,
      booking: {
        id: booking._id,
        status: booking.status,
        attendedAt: booking.attendedAt,
        member: booking.member
          ? { id: booking.member._id, name: booking.member.name, email: booking.member.email }
          : null,
        session: booking.session
          ? { id: booking.session._id, date: booking.session.date, startHour: booking.session.startHour }
          : null,
      },
    });
  })
);

module.exports = router;
