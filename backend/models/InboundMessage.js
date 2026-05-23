const mongoose = require('mongoose');

const InboundMessageSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    profileName: { type: String, default: '' },
    language: { type: String, enum: ['en', 'ta', ''], default: '' },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 1 },
    lastMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InboundMessage', InboundMessageSchema);
