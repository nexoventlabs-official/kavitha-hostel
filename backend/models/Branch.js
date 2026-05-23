const mongoose = require('mongoose');

/**
 * A PG branch (a property the hostel runs). Each branch keeps its own:
 *  - residents (linked via User.branch)
 *  - rent bills
 *  - Google review URL (sent via WhatsApp when a resident chooses "Review & Rating")
 *  - Google Sheet tab name (auto-derived from `code` if empty)
 */
const BranchSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '', trim: true },
    reviewUrl: { type: String, default: '', trim: true },
    websiteUrl: { type: String, default: '', trim: true },
    contactPhone: { type: String, default: '', trim: true },
    sheetTab: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BranchSchema.virtual('tabName').get(function () {
  return this.sheetTab || this.code;
});

module.exports = mongoose.model('Branch', BranchSchema);
