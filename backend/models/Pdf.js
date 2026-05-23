const mongoose = require('mongoose');

/**
 * Documents the bot can deliver. Each one has a fixed `slot`:
 *  - per_month_cost
 *  - food_timings
 *  - hostel_rules
 *
 * When the admin uploads a new PDF for an existing slot the previous Cloudinary
 * asset is destroyed, so there is always exactly one active PDF per slot.
 */
const PdfSchema = new mongoose.Schema(
  {
    slot: {
      type: String,
      required: true,
      unique: true,
      enum: ['per_month_cost', 'food_timings', 'hostel_rules'],
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    pdfUrl: { type: String, required: true },
    pdfPublicId: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Pdf', PdfSchema);
