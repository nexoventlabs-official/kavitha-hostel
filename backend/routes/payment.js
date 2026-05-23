/**
 * Payment endpoints — Razorpay payment-link based flow for rent bills.
 *
 *   GET  /api/payment/callback                — landing page after the user pays
 *   POST /api/payment/razorpay-webhook        — webhook from Razorpay
 *
 * Both paths converge to `markBillPaid(bill, paymentId, source)` which:
 *   1. Marks the RentBill as paid
 *   2. Updates the Google Sheets row
 *   3. Sends a "Payment Successful" WhatsApp message + Choose-Service CTA
 */
const express = require('express');
const crypto = require('crypto');
const RentBill = require('../models/RentBill');

const { markBillPaid } = require('../services/billPayments');

const router = express.Router();

/* ─────── Razorpay callback (browser GET after payment) ─────── */
router.get('/callback', async (req, res) => {
  try {
    const { razorpay_payment_link_id, razorpay_payment_id, razorpay_payment_link_status } =
      req.query;

    if (razorpay_payment_link_status === 'paid' && razorpay_payment_link_id) {
      const bill = await RentBill.findOne({ razorpayPaymentLinkId: razorpay_payment_link_id });
      if (bill && !bill.paid) {
        await markBillPaid(bill, {
          paymentId: razorpay_payment_id || '',
          method: 'razorpay_link',
          source: 'razorpay_callback',
        });
      }
    }

    res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Payment</title>
          <style>
            body { font-family: -apple-system, Inter, Arial, sans-serif; text-align: center; padding: 60px 20px; background: #f0fdf4; color: #166534; }
            .icon { font-size: 56px; }
            h1 { margin-top: 12px; }
            p { color: #4b5563; }
          </style>
        </head>
        <body>
          <div class="icon">✅</div>
          <h1>Payment received</h1>
          <p>Thank you! Your rent has been marked as paid.</p>
          <p>Please check your WhatsApp for the receipt.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[payment] callback error:', err.message);
    res.status(500).send('<h1>Payment error</h1><p>Please contact admin.</p>');
  }
});

/* ─────── Razorpay webhook (server-side notification) ─────── */
router.post('/razorpay-webhook', async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        console.warn('[payment] webhook called but RAZORPAY_WEBHOOK_SECRET not set');
        return res.status(500).json({ error: 'webhook secret not configured' });
      }
      const signature = req.headers['x-razorpay-signature'];
      const body = req.rawBody || JSON.stringify(req.body || {});
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
      if (!signature || signature !== expected) {
        return res.status(401).json({ error: 'invalid signature' });
      }

      const event = typeof req.body === 'object' ? req.body : JSON.parse(body);
      if (
        event.event === 'payment_link.paid' ||
        event.event === 'payment.captured'
      ) {
        const linkId =
          event.payload?.payment_link?.entity?.id ||
          event.payload?.payment?.entity?.notes?.payment_link_id;
        const paymentId =
          event.payload?.payment?.entity?.id ||
          event.payload?.payment_link?.entity?.payments?.[0]?.payment_id;

        if (linkId) {
          const bill = await RentBill.findOne({ razorpayPaymentLinkId: linkId });
          if (bill && !bill.paid) {
            await markBillPaid(bill, {
              paymentId: paymentId || '',
              method: 'razorpay_link',
              source: 'razorpay_webhook',
            });
          }
        }
      }

    res.json({ ok: true });
  } catch (err) {
    console.error('[payment] webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─────── Admin: mark a bill paid manually ─────── */
const auth = require('../middleware/auth');
router.post('/manual/:billId', auth, async (req, res) => {
  try {
    const bill = await RentBill.findById(req.params.billId);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    if (bill.paid) return res.json({ ok: true, alreadyPaid: true });
    await markBillPaid(bill, {
      paymentId: req.body.paymentRef || 'manual',
      method: 'manual',
      source: 'admin',
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
