const mongoose = require('mongoose');

// A member waiting for a place in a full session. Ordering is by createdAt,
// so the oldest entry is promoted first when a seat frees up.
const waitlistSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// A member can appear on a session's waitlist only once.
waitlistSchema.index({ session: 1, member: 1 }, { unique: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
