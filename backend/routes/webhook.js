const express = require('express');
const crypto = require('crypto');
const chatbot = require('../services/chatbot');
const meta = require('../services/metaCloud');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { markBillPaid, findBillByReference } = require('../services/billPayments');

const router = express.Router();

/**
 * Meta Native WhatsApp Pay sends the user's payment status as an inbound
 * interactive message with type `payment`. Payload shape (per Meta docs):
 *
 * {
 *   "interactive": {
 *     "type": "payment",
 *     "payment": {
 *       "reference_id": "RENT-<billId>",
 *       "status": "captured" | "failed" | "pending",
 *       "transaction_id": "...",        // (sometimes)
 *       "transaction": { "id": "...", "status": "...", "type": "razorpay" }
 *     }
 *   }
 * }
 *
 * We handle multiple possible field locations because Meta's payload
 * structure has varied over time.
 */
async function handlePaymentInteractive(msg) {
  const pay = msg.interactive?.payment || {};
  const referenceId =
    pay.reference_id ||
    pay.referenceId ||
    pay.transaction?.reference_id ||
    msg.interactive?.payment_status?.reference_id;
  const status = String(
    pay.status ||
      pay.transaction?.status ||
      msg.interactive?.payment_status?.status ||
      ''
  ).toLowerCase();
  const paymentId =
    pay.transaction?.id ||
    pay.transaction_id ||
    pay.payment_id ||
    '';

  console.log('[webhook] payment interactive', { referenceId, status, paymentId, fullPayload: pay });

  if (!referenceId) {
    console.warn('[webhook] no referenceId in payment payload');
    return false;
  }

  const bill = await findBillByReference(referenceId);
  if (!bill) {
    console.warn('[webhook] no bill found for reference', referenceId);
    return true;
  }

  console.log('[webhook] bill found', { billId: bill._id.toString(), currentPaid: bill.paid, metaReferenceId: bill.metaReferenceId });

  // Only "captured" / "success" / "paid" mark the bill as paid
  if (['captured', 'success', 'successful', 'paid', 'completed'].includes(status)) {
    if (!bill.paid) {
      console.log('[webhook] marking bill as paid', { billId: bill._id.toString(), status, paymentId });
      await markBillPaid(bill, {
        paymentId,
        method: 'meta_native',
        metaPaymentStatus: status,
        source: 'meta_native_pay',
      });
    } else {
      console.log('[webhook] bill already paid, skipping', { billId: bill._id.toString() });
    }
  } else {
    // Persist whatever status came in (pending / failed / etc.) for audit
    console.log('[webhook] payment not successful, updating status', { billId: bill._id.toString(), status });
    bill.metaPaymentStatus = status || bill.metaPaymentStatus;
    if (paymentId && !bill.paymentId) bill.paymentId = paymentId;
    await bill.save();
  }
  return true;
}

/**
 * The flow's SERVICE_SELECT screen calls `complete` with
 * `payload.kind = 'service_pick'` + `selected_service`. We dispatch the
 * matching follow-up message here (PDF, register CTA, payment link, etc.).
 */
async function handleFlowCompletion(msg) {
  const nfm = msg.interactive?.nfm_reply;
  if (!nfm || !nfm.response_json) return false;

  let payload = {};
  try {
    payload = JSON.parse(nfm.response_json) || {};
  } catch {
    return false;
  }
  if (payload.kind !== 'service_pick') return false;

  const phone = chatbot.normPhone(msg.from);
  const lang = await chatbot.getLanguage(phone);
  const sel = payload.selected_service;

  try {
    switch (sel) {
      case 'register':
        await chatbot.sendRegisterCta(phone, lang);
        return true;
      case 'per_month_cost':
      case 'food_timings':
      case 'hostel_rules':
        await chatbot.sendSlotPdf(phone, sel, lang);
        return true;
      case 'change_language':
        await chatbot.sendLanguageChoice(phone, lang);
        return true;
      case 'contact':
        await chatbot.sendContact(phone, lang);
        return true;
      case 'pay_rent':
        await chatbot.sendPayRent(phone, lang);
        return true;
      case 'website': {
        const user = await User.findOne({ phone }).populate('branch').lean();
        await chatbot.sendWebsite(phone, lang, user?.branch);
        return true;
      }
      case 'review': {
        const user = await User.findOne({ phone }).populate('branch').lean();
        await chatbot.sendReview(phone, lang, user?.branch);
        return true;
      }
      default:
        await chatbot.sendChooseService(phone, lang);
        return true;
    }
  } catch (err) {
    console.error('[webhook] dispatch failed:', err.response?.data || err.message);
    try {
      await meta.sendText(
        phone,
        'Something went wrong. Please type *hi* to start again.'
      );
    } catch {}
    return true;
  }
}

/* ─── Webhook verification (Meta GET) ─── */
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (!verifyToken) return res.sendStatus(500);

  if (mode === 'subscribe' && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  if (!mode && !token) {
    return res.json({ status: 'webhook active' });
  }
  return res.sendStatus(403);
});

/* ─── Signature verification ─── */
function verifySignature(req) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* ─── Webhook receiver (Meta POST) ─── */
router.post('/meta', async (req, res) => {
  res.sendStatus(200);

  if (process.env.META_APP_SECRET && !verifySignature(req)) {
    console.warn('[webhook] invalid signature');
    return;
  }

  try {
    const body = req.body || {};
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const msg of messages) {
          const from = msg.from;
          const profileName = contacts[0]?.profile?.name || '';
          let text = '';
          const type = msg.type;
          let interactive;

          if (msg.type === 'text') text = msg.text?.body || '';
          else if (msg.type === 'interactive') {
            interactive = msg.interactive;
            // Native WhatsApp Pay payment status callback
            if (
              msg.interactive?.type === 'payment' ||
              msg.interactive?.type === 'payment_status' ||
              msg.interactive?.payment
            ) {
              try {
                const handled = await handlePaymentInteractive(msg);
                if (handled) continue;
              } catch (err) {
                console.error('[webhook] payment handler failed:', err.message);
              }
            }
            if (msg.interactive?.type === 'nfm_reply') {
              const handled = await handleFlowCompletion(msg);
              if (handled) continue;
            }
            text =
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              '';
          } else if (msg.type === 'button') {
            text = msg.button?.text || '';
          }

          await chatbot.handleInbound({
            phone: from,
            profileName,
            type,
            text,
            interactive,
          });
        }
      }
    }
  } catch (err) {
    console.error('[webhook] handler error:', err.message);
  }
});

module.exports = router;
