/**
 * Shared "mark a rent bill as paid" pipeline.
 *
 * Called from:
 *   - routes/payment.js          (Razorpay link callback / webhook / manual)
 *   - routes/webhook.js          (Meta Native WhatsApp Pay — `payment` interactive)
 *
 * Pipeline:
 *   1. Set RentBill.paid + paidAt + paymentId
 *   2. Sync the row to Google Sheets (branch tab)
 *   3. Send a "Payment Successful" image+body on WhatsApp
 *   4. Re-open the Choose-Service flow CTA
 */
const RentBill = require('../models/RentBill');

const meta = require('./metaCloud');
const flowImages = require('./flowImages');
const googleSheets = require('./googleSheets');
const chatbot = require('./chatbot');
const { t } = require('./i18n');

/**
 * @param {object} bill - RentBill mongoose doc (NOT lean)
 * @param {object} opts
 * @param {string} opts.paymentId
 * @param {string} opts.method   - 'meta_native' | 'razorpay_link' | 'manual'
 * @param {string} [opts.metaPaymentStatus]
 * @param {string} [opts.source] - debug label
 * @returns {Promise<boolean>}   - true if the bill transitioned to paid here
 */
async function markBillPaid(bill, opts = {}) {
  if (!bill) return false;
  if (bill.paid) return false;

  bill.paid = true;
  bill.paidAt = new Date();
  bill.paymentId = opts.paymentId || bill.paymentId || '';
  bill.paymentMethod = opts.method || bill.paymentMethod || 'manual';
  if (opts.metaPaymentStatus) bill.metaPaymentStatus = opts.metaPaymentStatus;
  await bill.save();

  const populated = await RentBill.findById(bill._id)
    .populate('user')
    .populate('branch')
    .lean();
  if (!populated || !populated.user) return true;

  // Google Sheets — record paid amount + date in the branch tab (non-blocking)
  googleSheets
    .recordPayment({
      user: populated.user,
      branch: populated.branch,
      monthLabel: populated.monthLabel || populated.monthKey,
      amount: populated.totalAmount,
      paidAt: populated.paidAt,
      paymentId: populated.paymentId,
    })
    .catch((err) => console.warn('[billPayments] sheets recordPayment failed:', err.message));

  // WhatsApp confirmation (non-blocking)
  (async () => {
    try {
      const lang = await chatbot.getLanguage(populated.user.phone);
      const header = await flowImages.getUrl('chat_payment_success_header');
      const bodyText = t('payment_success_body', lang, {
        amount: populated.totalAmount,
        month: populated.monthLabel || populated.monthKey,
        ref: populated.paymentId || populated._id.toString().slice(-8),
      });
      if (header) await meta.sendImage(populated.user.phone, header, bodyText);
      else await meta.sendText(populated.user.phone, bodyText);
      await chatbot.sendChooseService(populated.user.phone, lang);
    } catch (err) {
      console.error(
        '[billPayments] WhatsApp delivery failed:',
        err.response?.data || err.message
      );
    }
  })();

  console.log(
    '[billPayments] bill marked paid',
    { billId: populated._id.toString(), method: opts.method, source: opts.source || '' }
  );
  return true;
}

/**
 * Look up a bill from a Meta Native Pay reference id.
 * Reference IDs we send are `RENT-<billId>`, but accept the raw bill id too.
 */
async function findBillByReference(referenceId) {
  if (!referenceId) return null;
  let bill = await RentBill.findOne({ metaReferenceId: referenceId });
  if (bill) return bill;
  const stripped = String(referenceId).replace(/^RENT-/i, '');
  if (/^[a-f0-9]{24}$/i.test(stripped)) {
    bill = await RentBill.findById(stripped);
  }
  return bill;
}

module.exports = { markBillPaid, findBillByReference };
