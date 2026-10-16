const mongoose = require('mongoose');

// A gym member or an admin. Admin accounts are created by the seed script or
// directly in the database, never through the public registration route.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['member', 'admin'],
      default: 'member',
    },
  },
  { timestamps: true }
);

// Never send the password hash to the client.
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
  };
};

module.exports = mongoose.model('User', userSchema);
