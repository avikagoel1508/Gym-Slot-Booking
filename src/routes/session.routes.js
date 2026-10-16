const express = require('express');
const Session = require('../models/Session.js');
const Booking = require('../models/Booking.js');
const Waitlist = require('../models/Waitlist.js');
const { asyncHandler } = require('../utils/asyncHandler.js');
const { env } = require('../config/env.js');
const { errors } = require('../utils/errors.js');
const { requireAuth, requireAdmin } = require('../middleware/auth.js');
const { isValidDateString, hasStarted } = require('../utils/time.js');
const { serializeSession } = require('../utils/serialize.js');

const router = express.Router();
router.use(requireAuth); // every route below needs a logged in user

// GET /api/sessions?date=YYYY-MM-DD
// Anyone logged in can browse sessions and filter by date.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.date) {
      if (!isValidDateString(req.query.date)) {
        throw errors.unprocessable('Date must look like 2026-03-09.');
      }
      filter.date = req.query.date;
    }

    const sessions = await Session.find(filter).sort({ date: 1, startHour: 1 });
    const ids = sessions.map((s) => s._id);
    const userId = req.user._id;

    // One query each instead of a heavy aggregation pipeline.
    const [myBookings, myWaits, waitCounts] = await Promise.all([
      Booking.find({ session: { $in: ids }, member: userId, status: 'booked' }),
      Waitlist.find({ session: { $in: ids }, member: userId }),
      Waitlist.find({ session: { $in: ids } }),
    ]);

    const bookedSet = new Set(myBookings.map((b) => String(b.session)));
    const waitingSet = new Set(myWaits.map((w) => String(w.session)));
    const waitCountMap = {};
    waitCounts.forEach((w) => {
      const key = String(w.session);
      waitCountMap[key] = (waitCountMap[key] || 0) + 1;
    });

    res.json({
      sessions: sessions.map((s) =>
        serializeSession(s, {
          waitlistCount: waitCountMap[String(s._id)] || 0,
          isBooked: bookedSet.has(String(s._id)),
          isWaiting: waitingSet.has(String(s._id)),
        })
      ),
    });
  })
);

// GET /api/sessions/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) throw errors.notFound('Session not found.', 'SESSION_NOT_FOUND');

    const [booking, waitEntry, waitCount] = await Promise.all([
      Booking.findOne({ session: session._id, member: req.user._id, status: 'booked' }),
      Waitlist.findOne({ session: session._id, member: req.user._id }),
      Waitlist.countDocuments({ session: session._id }),
    ]);

    res.json({
      session: serializeSession(session, {
        waitlistCount: waitCount,
        isBooked: Boolean(booking),
        isWaiting: Boolean(waitEntry),
      }),
    });
  })
);

// POST /api/sessions  (admin only)
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { date, startHour } = req.body || {};

    if (!isValidDateString(date)) {
      throw errors.unprocessable('Date must look like 2026-03-09.');
    }
    if (!Number.isInteger(startHour) || startHour < 6 || startHour > 22) {
      throw errors.unprocessable('Start hour must be a whole number between 6 and 22.');
    }
    if (hasStarted({ date, startHour })) {
      throw errors.unprocessable('That session time is in the past.');
    }

    const clash = await Session.findOne({ date, startHour });
    if (clash) {
      throw errors.conflict('A session already starts at that time.', 'SESSION_EXISTS');
    }

    // Capacity is fixed at 20 by the gym, never taken from the request.
    const session = await Session.create({
      date,
      startHour,
      capacity: env.CAPACITY,
      createdBy: req.user._id,
    });

    res.status(201).json({ session: serializeSession(session, { waitlistCount: 0, isBooked: false, isWaiting: false }) });
  })
);

module.exports = router;
