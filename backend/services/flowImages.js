const FlowImage = require('../models/FlowImage');

/**
 * Catalog of every image slot the WhatsApp flow + chatbot uses.
 * The admin panel lists these slots and lets the user upload an image for each.
 */
const IMAGE_KEYS = [
  // ─── Chatbot (sent as message-header images outside the flow) ───
  { key: 'chat_welcome_header', label: 'Welcome message — header image (English/Tamil prompt)', group: 'chatbot' },
  { key: 'chat_choose_service_header', label: 'Choose Service header (sent after language pick)', group: 'chatbot' },
  { key: 'chat_register_header', label: 'Register message header (CTA URL)', group: 'chatbot' },
  { key: 'chat_contact_header', label: 'Contact message header', group: 'chatbot' },
  { key: 'chat_website_header', label: 'Website message header', group: 'chatbot' },
  { key: 'chat_review_header', label: 'Review & Rating message header', group: 'chatbot' },
  { key: 'chat_pay_rent_header', label: 'Pay Rent rent-details header', group: 'chatbot' },
  { key: 'chat_payment_success_header', label: 'Payment success header', group: 'chatbot' },

  // ─── Flow service-screen ───
  { key: 'flow_welcome_banner', label: 'Flow service screen banner', group: 'flow_banner' },

  // Non-registered service icons
  { key: 'icon_register', label: 'Service icon: Register', group: 'service_icons' },
  { key: 'icon_per_month_cost', label: 'Service icon: Per Month Cost', group: 'service_icons' },
  { key: 'icon_food_timings', label: 'Service icon: Food Timings', group: 'service_icons' },
  { key: 'icon_hostel_rules', label: 'Service icon: Hostel Rules', group: 'service_icons' },
  { key: 'icon_change_language', label: 'Service icon: Change Language', group: 'service_icons' },
  { key: 'icon_contact', label: 'Service icon: Contact', group: 'service_icons' },

  // Registered service icons
  { key: 'icon_pay_rent', label: 'Service icon: Pay Rent', group: 'service_icons' },
  { key: 'icon_website', label: 'Service icon: Website', group: 'service_icons' },
  { key: 'icon_review', label: 'Service icon: Review & Rating', group: 'service_icons' },
];

async function ensureKeysExist() {
  for (const item of IMAGE_KEYS) {
    await FlowImage.updateOne(
      { key: item.key },
      { $setOnInsert: { key: item.key, label: item.label, url: '', publicId: '' } },
      { upsert: true }
    );
  }
}

async function getUrl(key) {
  const doc = await FlowImage.findOne({ key }).lean();
  return doc?.url || '';
}

async function getMap(keys) {
  const docs = await FlowImage.find({ key: { $in: keys } }).lean();
  const out = {};
  keys.forEach((k) => (out[k] = ''));
  docs.forEach((d) => {
    out[d.key] = d.url || '';
  });
  return out;
}

module.exports = { IMAGE_KEYS, ensureKeysExist, getUrl, getMap };
