const mongoose = require('mongoose');
const { env } = require('../config/env.js');

// A one-hour gym session starting on the hour. `date` is a plain
// "YYYY-MM-DD" string and `startHour` is an integer 0-23, which keeps
// timezone handling simple for this app.
const sessionSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startHour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
      validate: Number.isInteger,
    },
    capacity: {
      type: Number,
      default: env.CAPACITY,
      min: 1,
    },
    // Live count of confirmed (booked + attended) places. It is updated with
    // atomic $inc so two simultaneous bookings can never exceed capacity.
    confirmedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Two sessions can never share the same start time.
sessionSchema.index({ date: 1, startHour: 1 }, { unique: true });

module.exports = mongoose.model('Session', sessionSchema);
