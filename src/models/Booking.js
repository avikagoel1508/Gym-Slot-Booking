const mongoose = require('mongoose');

// A member's booking of a session. `status` moves booked -> attended (check-in)
// or booked -> cancelled. A cancelled booking keeps its row for history.
const bookingSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['booked', 'attended', 'cancelled'],
      default: 'booked',
    },
    code: { type: String, required: true },
    attendedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One ACTIVE booking per member per session. Cancelled rows are excluded, so a
// member can cancel and later rebook the same session.
bookingSchema.index(
  { session: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: 'booked' } }
);

// Check-in codes are unique across every booking.
bookingSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
