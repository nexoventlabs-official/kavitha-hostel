const crypto = require('crypto');
const meta = require('./metaCloud');
const flowImages = require('./flowImages');
const { t } = require('./i18n');
const InboundMessage = require('../models/InboundMessage');
const User = require('../models/User');
const Pdf = require('../models/Pdf');
const Branch = require('../models/Branch');
const RegistrationToken = require('../models/RegistrationToken');
const RentBill = require('../models/RentBill');
const razorpayService = require('./razorpay');

const GREETING_RE = /^(hi+|h?ello+|hey+|hai+|vanakkam|வணக்கம்|menu|services|help|start)\b/i;

function isGreeting(text) {
  if (!text) return false;
  const s = String(text).trim();
  if (!s) return false;
  return GREETING_RE.test(s);
}

/** Stable phone normalisation (digits only, no leading +). */
function normPhone(p) {
  return String(p || '').replace(/\D/g, '');
}

/* ───────── inbound tracking ───────── */
async function trackInbound({ phone, profileName, text, language }) {
  if (!phone) return;
  try {
    const update = {
      $setOnInsert: { firstSeenAt: new Date() },
      $set: {
        profileName: profileName || '',
        lastSeenAt: new Date(),
        lastMessage: (text || '').slice(0, 500),
      },
      $inc: { messageCount: 1 },
    };
    if (language) update.$set.language = language;
    await InboundMessage.findOneAndUpdate({ phone }, update, { upsert: true });
  } catch (err) {
    console.warn('[chatbot] trackInbound failed:', err.message);
  }
}

async function getLanguage(phone) {
  const user = await User.findOne({ phone }).lean();
  if (user?.language) return user.language;
  const inb = await InboundMessage.findOne({ phone }).lean();
  return inb?.language || 'en';
}

async function setLanguage(phone, language) {
  if (!['en', 'ta'].includes(language)) language = 'en';
  await InboundMessage.findOneAndUpdate(
    { phone },
    { $set: { language } },
    { upsert: true }
  );
  await User.findOneAndUpdate({ phone }, { $set: { language } });
}

/* ───────── outbound message helpers ───────── */

/** Step 1 — welcome message with EN/TA reply buttons. */
async function sendLanguageChoice(phone, lang = 'en') {
  const headerImageUrl = await flowImages.getUrl('chat_welcome_header');
  await meta.sendButtons(phone, {
    headerImageUrl: headerImageUrl || undefined,
    headerText: !headerImageUrl ? 'Kavitha PG' : undefined,
    bodyText: t('welcome_body', lang),
    footerText: t('welcome_footer', lang),
    buttons: [
      { id: 'lang_en', title: t('lang_button_en', lang) },
      { id: 'lang_ta', title: t('lang_button_ta', lang) },
    ],
  });
}

/** Step 2 — "Choose Service" flow message. */
async function sendChooseService(phone, lang = 'en') {
  const flowId = process.env.WHATSAPP_FLOW_ID;
  if (!flowId) {
    await meta.sendText(phone, 'Our service menu is being set up. Please try again soon.');
    return;
  }
  const headerImageUrl = await flowImages.getUrl('chat_choose_service_header');
  const mode =
    String(process.env.WHATSAPP_FLOW_STATUS || '').toUpperCase() === 'PUBLISHED'
      ? 'published'
      : 'draft';

  await meta.sendFlowMessage(phone, {
    flowId,
    flowCta: t('choose_service_cta', lang),
    headerImageUrl: headerImageUrl || undefined,
    headerText: !headerImageUrl ? 'Kavitha PG' : undefined,
    bodyText: t('choose_service_body', lang),
    footerText: t('choose_service_footer', lang),
    flowToken: `welcome_${phone}_${lang}`,
    mode,
  });
}

/** Re-open the menu (used after Pay Rent / PDF / etc.) without resending the language buttons. */
async function reopenMenu(phone, lang) {
  return sendChooseService(phone, lang);
}

/** Send a PDF for one of the fixed slots (per_month_cost / food_timings / hostel_rules). */
async function sendSlotPdf(phone, slot, lang) {
  const pdf = await Pdf.findOne({ slot, active: true }).lean();
  if (!pdf || !pdf.pdfUrl) {
    await meta.sendText(
      phone,
      'This document is not available right now. Please try again later.'
    );
    await sendChooseService(phone, lang);
    return;
  }

  const filename = `${(pdf.name || slot).replace(/[^\w\d-]+/g, '_').slice(0, 60)}.pdf`;

  // Single message: PDF header + body. Then immediately the Choose Service flow message.
  const flowId = process.env.WHATSAPP_FLOW_ID;
  const mode =
    String(process.env.WHATSAPP_FLOW_STATUS || '').toUpperCase() === 'PUBLISHED'
      ? 'published'
      : 'draft';

  const bodyText = t('pdf_body', lang, {
    name: pdf.name || slot,
    description: pdf.description || '',
  });

  if (flowId) {
    await meta.sendFlowMessage(phone, {
      flowId,
      flowCta: t('choose_service_cta', lang),
      headerDocumentUrl: pdf.pdfUrl,
      headerDocumentFilename: filename,
      bodyText,
      footerText: t('choose_service_footer', lang),
      flowToken: `welcome_${phone}_${lang}`,
      mode,
    });
  } else {
    await meta.sendDocument(phone, pdf.pdfUrl, { filename, caption: bodyText });
  }
}

/** Send the register CTA URL (creates a one-time token first). */
async function sendRegisterCta(phone, lang) {
  const token = crypto.randomBytes(20).toString('hex');
  await RegistrationToken.create({
    token,
    phone,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const baseUrl = (process.env.BACKEND_URL || '').replace(/\/+$/, '');
  const url = `${baseUrl}/register/?t=${token}`;
  const headerImageUrl = await flowImages.getUrl('chat_register_header');

  await meta.sendCtaUrl(phone, {
    headerImageUrl: headerImageUrl || undefined,
    headerText: !headerImageUrl ? 'Register' : undefined,
    bodyText: t('register_body', lang),
    footerText: 'Kavitha PG',
    ctaText: t('register_cta', lang),
    ctaUrl: url,
  });
}

/** Send the Contact card. */
async function sendContact(phone, lang) {
  const branchPhone = process.env.CONTACT_PHONE || '+91-9999999999';
  const branchAddress = process.env.CONTACT_ADDRESS || 'Kavitha PG, Tamil Nadu';
  const headerImageUrl = await flowImages.getUrl('chat_contact_header');
  const bodyText = t('contact_body', lang, { phone: branchPhone, address: branchAddress });

  if (headerImageUrl) {
    await meta.sendImage(phone, headerImageUrl, bodyText);
  } else {
    await meta.sendText(phone, bodyText);
  }
  await sendChooseService(phone, lang);
}

/** Send the Website CTA. */
async function sendWebsite(phone, lang, branch) {
  const url =
    (branch?.websiteUrl && branch.websiteUrl.trim()) ||
    process.env.WEBSITE_URL ||
    'https://example.com';
  const headerImageUrl = await flowImages.getUrl('chat_website_header');
  await meta.sendCtaUrl(phone, {
    headerImageUrl: headerImageUrl || undefined,
    headerText: !headerImageUrl ? 'Kavitha PG' : undefined,
    bodyText: t('website_body', lang),
    footerText: 'Kavitha PG',
    ctaText: t('website_cta', lang),
    ctaUrl: url,
  });
}

/** Send Review & Rating CTA — uses the user's branch Google review URL. */
async function sendReview(phone, lang, branch) {
  const url = branch?.reviewUrl?.trim();
  if (!url) {
    await meta.sendText(
      phone,
      lang === 'ta'
        ? 'மதிப்பீடு இணைப்பு இன்னும் கட்டமைக்கப்படவில்லை. நிர்வாகியை தொடர்பு கொள்ளவும்.'
        : 'The review link is not configured yet. Please contact the admin.'
    );
    await sendChooseService(phone, lang);
    return;
  }
  const headerImageUrl = await flowImages.getUrl('chat_review_header');
  await meta.sendCtaUrl(phone, {
    headerImageUrl: headerImageUrl || undefined,
    headerText: !headerImageUrl ? 'Review' : undefined,
    bodyText: t('review_body', lang, { branch: branch?.name || 'Kavitha PG' }),
    footerText: 'Kavitha PG',
    ctaText: t('review_cta', lang),
    ctaUrl: url,
  });
}

/**
 * Send rent bill via Meta Native WhatsApp Pay (Order Details message).
 *
 * Flow:
 *   1. Show table-style summary in body
 *   2. "Review and Pay" button (built into order_details) opens UPI / cards
 *      inside WhatsApp; payment processed via Razorpay (`KavithaHostel` Meta
 *      payment configuration).
 *   3. Payment status comes back via webhook → `payment` interactive type.
 *
 * Falls back to a Razorpay Payment Link CTA only if META_PAYMENT_CONFIGURATION_NAME
 * is not configured.
 */
async function sendPayRent(phone, lang) {
  const user = await User.findOne({ phone }).populate('branch').lean();
  if (!user) {
    await meta.sendText(phone, t('not_registered_for_rent', lang));
    await sendChooseService(phone, lang);
    return;
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const bill = await RentBill.findOne({ user: user._id, monthKey });

  if (!bill) {
    await meta.sendText(phone, t('no_bill_body', lang));
    await sendChooseService(phone, lang);
    return;
  }
  if (bill.paid) {
    await meta.sendText(phone, t('bill_already_paid', lang, { month: bill.monthLabel }));
    await sendChooseService(phone, lang);
    return;
  }

  const headerImageUrl = await flowImages.getUrl('chat_pay_rent_header');
  const otherLine =
    bill.otherAmount > 0
      ? (lang === 'ta' ? 'பிற       ₹' : 'Other      ₹') + bill.otherAmount + '\n'
      : '';

  const bodyText = t('rent_caption', lang, {
    month: bill.monthLabel || monthKey,
    name: user.name,
    room: bill.roomNumber || user.roomNumber || '—',
    branch: user.branch?.name || user.branchCode || '—',
    rent: bill.rentAmount,
    eb: bill.ebAmount,
    otherLine,
    total: bill.totalAmount,
  });

  const configurationName = process.env.META_PAYMENT_CONFIGURATION_NAME;

  // ─── Path A — Meta Native WhatsApp Pay (order_details) ───
  if (configurationName) {
    const referenceId = `RENT-${bill._id}`;
    bill.metaReferenceId = referenceId;
    bill.metaPaymentStatus = 'pending';
    bill.paymentMethod = 'meta_native';
    await bill.save();

    const items = [
      {
        retailerId: `rent-${monthKey}`,
        name: `Rent — ${bill.monthLabel || monthKey}`,
        amount: bill.rentAmount,
        quantity: 1,
      },
    ];
    if (bill.ebAmount > 0) {
      items.push({
        retailerId: `eb-${monthKey}`,
        name: `Electricity — ${bill.monthLabel || monthKey}`,
        amount: bill.ebAmount,
        quantity: 1,
      });
    }
    if (bill.otherAmount > 0) {
      items.push({
        retailerId: `other-${monthKey}`,
        name: `Other charges — ${bill.monthLabel || monthKey}`,
        amount: bill.otherAmount,
        quantity: 1,
      });
    }

    try {
      await meta.sendOrderDetails(phone, {
        referenceId,
        configurationName,
        razorpayMid: process.env.RAZORPAY_MID || undefined,
        headerImageUrl: headerImageUrl || undefined,
        headerText: !headerImageUrl ? 'Rent Bill' : undefined,
        bodyText,
        footerText: 'Kavitha PG',
        items,
        subtotal: bill.totalAmount,
        totalAmount: bill.totalAmount,
        currency: 'INR',
        offset: 100,
        orderType: 'digital-goods',
        notes: {
          bill_id: bill._id.toString(),
          month: bill.monthLabel || monthKey,
          resident: user.name,
          phone,
        },
      });
      return;
    } catch (err) {
      console.error(
        '[chatbot] sendOrderDetails failed, falling back to payment-link:',
        err.response?.data || err.message
      );
      // fall through to Razorpay link
    }
  }

  // ─── Path B — Razorpay Payment Link fallback ───
  if (!bill.razorpayPaymentLinkUrl) {
    try {
      const link = await razorpayService.createPaymentLink(
        bill.totalAmount,
        `RENT-${bill._id}`,
        phone,
        user.name
      );
      bill.razorpayPaymentLinkId = link.id;
      bill.razorpayPaymentLinkUrl = link.short_url;
      bill.razorpayOrderId = link.id;
      bill.paymentMethod = 'razorpay_link';
      await bill.save();
    } catch (err) {
      console.error('[chatbot] razorpay payment link failed:', err.message);
      await meta.sendText(
        phone,
        lang === 'ta'
          ? 'பணம் செலுத்தும் இணைப்பை உருவாக்க முடியவில்லை. பின்னர் முயற்சிக்கவும்.'
          : 'Could not create a payment link right now. Please try again later.'
      );
      return;
    }
  }

  await meta.sendCtaUrl(phone, {
    headerImageUrl: headerImageUrl || undefined,
    headerText: !headerImageUrl ? 'Rent Bill' : undefined,
    bodyText,
    footerText: 'Kavitha PG',
    ctaText: t('pay_now_cta', lang),
    ctaUrl: bill.razorpayPaymentLinkUrl,
  });
}

/* ───────── main inbound dispatcher ───────── */
async function handleInbound({ phone, profileName, type, text, interactive }) {
  const norm = normPhone(phone);
  await trackInbound({ phone: norm, profileName, text });

  const lang = await getLanguage(norm);

  // Handle reply button clicks (language pick)
  if (type === 'interactive' && interactive?.type === 'button_reply') {
    const id = interactive.button_reply?.id || '';
    if (id === 'lang_en' || id === 'lang_ta') {
      const newLang = id === 'lang_en' ? 'en' : 'ta';
      await setLanguage(norm, newLang);
      await meta.sendText(norm, t('lang_set', newLang));
      await sendChooseService(norm, newLang);
      return;
    }
  }

  // Greeting → restart from language choice
  if (isGreeting(text) || !text) {
    await sendLanguageChoice(norm, lang);
    return;
  }

  // Otherwise nudge them back to the menu
  await meta.sendText(norm, t('fallback_prompt', lang));
}

module.exports = {
  handleInbound,
  sendLanguageChoice,
  sendChooseService,
  sendSlotPdf,
  sendRegisterCta,
  sendContact,
  sendWebsite,
  sendReview,
  sendPayRent,
  reopenMenu,
  getLanguage,
  setLanguage,
  normPhone,
};
