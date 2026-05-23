const mongoose = require('mongoose');

/**
 * One-time link that the WhatsApp register CTA URL points to.
 * When a non-registered user picks "Register" we create a token containing
 * their phone number, then send `${BACKEND_URL}/register?t=<token>` as the
 * CTA URL. The public registration page validates the token and pre-fills the
 * (locked) WhatsApp number.
 */
const RegistrationTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RegistrationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RegistrationToken', RegistrationTokenSchema);
