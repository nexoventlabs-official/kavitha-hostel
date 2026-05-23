const mongoose = require('mongoose');

/**
 * Monthly rent + electricity bill for a single resident.
 * `monthKey` is the period in yyyy-mm form (e.g. "2026-05") so we can quickly
 * look up "current month" or any historical month for a resident.
 */
const RentBillSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    monthKey: { type: String, required: true, index: true }, // e.g. 2026-05
    monthLabel: { type: String, default: '' }, // e.g. "May 2026"

    roomNumber: { type: String, default: '' },
    rentAmount: { type: Number, default: 0 },
    ebAmount: { type: Number, default: 0 },
    otherAmount: { type: Number, default: 0 },
    notes: { type: String, default: '' },

    totalAmount: { type: Number, default: 0 },

    paid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    paymentId: { type: String, default: '' },
    paymentMethod: { type: String, default: '' }, // 'meta_native' | 'razorpay_link' | 'manual'

    // Meta Native WhatsApp Pay (order_details message)
    metaReferenceId: { type: String, default: '', index: true },
    metaPaymentStatus: { type: String, default: '' }, // pending|captured|failed|...

    // Razorpay payment-link fallback (kept for backward compat)
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentLinkId: { type: String, default: '', index: true },
    razorpayPaymentLinkUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

RentBillSchema.index({ user: 1, monthKey: 1 }, { unique: true });

RentBillSchema.pre('save', function (next) {
  this.totalAmount =
    (this.rentAmount || 0) + (this.ebAmount || 0) + (this.otherAmount || 0);
  next();
});

module.exports = mongoose.model('RentBill', RentBillSchema);
