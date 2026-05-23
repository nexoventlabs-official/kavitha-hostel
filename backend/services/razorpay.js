const Razorpay = require('razorpay');

let razorpay = null;
let lastKeyId = null;

function getClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      'Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env'
    );
  }
  if (!razorpay || lastKeyId !== process.env.RAZORPAY_KEY_ID) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    lastKeyId = process.env.RAZORPAY_KEY_ID;
  }
  return razorpay;
}

/** Generic order (kept for parity with the Restarunt project). */
async function createOrder(amount, receipt) {
  const client = getClient();
  return client.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt,
    notes: { receipt },
  });
}

/**
 * Create a Razorpay Payment Link (preferred for WhatsApp rent payments).
 * `customerPhone` may be E.164 digits, with or without country code.
 */
async function createPaymentLink(amount, receipt, customerPhone, customerName) {
  const client = getClient();
  let cleanPhone = String(customerPhone || '').replace(/\D/g, '');
  if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.substring(cleanPhone.length - 10);
  }
  if (cleanPhone.length === 10) cleanPhone = '+91' + cleanPhone;

  const backend = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
  const link = await client.paymentLink.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    accept_partial: false,
    description: `Kavitha PG — ${receipt}`,
    customer: { name: customerName || 'Resident', contact: cleanPhone },
    notify: { sms: true, email: false },
    reminder_enable: true,
    notes: { receipt },
    callback_url: `${backend}/api/payment/callback`,
    callback_method: 'get',
  });
  return link;
}

async function getPaymentDetails(paymentId) {
  return getClient().payments.fetch(paymentId);
}

async function getPaymentLinkDetails(linkId) {
  return getClient().paymentLink.fetch(linkId);
}

module.exports = {
  createOrder,
  createPaymentLink,
  getPaymentDetails,
  getPaymentLinkDetails,
};
